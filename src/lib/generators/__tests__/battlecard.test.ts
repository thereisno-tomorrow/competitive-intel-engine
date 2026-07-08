import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCompetitorFindUnique = vi.fn();
const mockItemFindMany = vi.fn();
const mockClaimFindMany = vi.fn();
const mockSectionUpsert = vi.fn();
const mockRevFindFirst = vi.fn();
const mockRevCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    competitor: { findUnique: (...a: unknown[]) => mockCompetitorFindUnique(...a) },
    intelligenceItem: { findMany: (...a: unknown[]) => mockItemFindMany(...a) },
    positioningClaim: { findMany: (...a: unknown[]) => mockClaimFindMany(...a) },
    battlecardSection: { upsert: (...a: unknown[]) => mockSectionUpsert(...a) },
    battlecardSectionRevision: {
      findFirst: (...a: unknown[]) => mockRevFindFirst(...a),
      create: (...a: unknown[]) => mockRevCreate(...a),
    },
  },
}));

import { generateBattlecardSections } from "../battlecard";

// A judge that passes clean; toggled per-test.
function makeLLM(opts: {
  content: (sectionKey: string, attempt: number) => unknown;
  judge?: unknown;
}) {
  const attemptBySection: Record<string, number> = {};
  return {
    classifyStructured: vi.fn().mockResolvedValue(opts.judge ?? { violations: [] }),
    generateStructured: vi.fn(async (prompt: string) => {
      // Infer the section key from the prompt to vary content.
      const key =
        ["weaknesses", "reframes", "whyWeLose", "openQuestions"].find((k) =>
          prompt.includes(`"${k}" section`),
        ) ?? "unknown";
      attemptBySection[key] = (attemptBySection[key] ?? 0) + 1;
      return {
        content: opts.content(key, attemptBySection[key]!),
        changeSummary: `updated ${key}`,
      };
    }),
  };
}

describe("generateBattlecardSections (U16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompetitorFindUnique.mockResolvedValue({ id: "c1", name: "Kyriba", tier: "TIER_1" });
    mockItemFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockSectionUpsert.mockImplementation(async ({ where }: { where: { competitorId_sectionKey: { sectionKey: string } } }) => ({
      id: `sec-${where.competitorId_sectionKey.sectionKey}`,
    }));
    mockRevFindFirst.mockResolvedValue({ id: "rev0", content: [{ text: "old" }] });
    mockRevCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: "rev1", ...data }));
  });

  it("writes a new revision with a diff and change note for a passing section", async () => {
    const llm = makeLLM({
      content: (key) => (key === "openQuestions" ? ["q?"] : [{ text: "structural weakness", evidenceTier: "INFERRED" }]),
    });
    const results = await generateBattlecardSections(llm as never, { competitorId: "c1", sectionKeys: ["weaknesses"] });

    expect(results[0]?.status).toBe("PASSED");
    expect(mockRevCreate).toHaveBeenCalledTimes(1);
    const createArg = mockRevCreate.mock.calls[0]![0] as { data: { diff: unknown; changeSummary: string; parentRevisionId: string } };
    expect(createArg.data.parentRevisionId).toBe("rev0");
    expect(createArg.data.diff).toMatchObject({ before: [{ text: "old" }] });
    expect(createArg.data.changeSummary).toContain("weaknesses");
  });

  it("regenerates and REJECTS an all-'we win' whyWeLose section (loss-condition rule)", async () => {
    const llm = makeLLM({ content: () => [] }); // always empty → loss-condition fails every attempt
    const results = await generateBattlecardSections(llm as never, { competitorId: "c1", sectionKeys: ["whyWeLose"] });

    expect(results[0]?.status).toBe("REJECTED");
    // Retried up to the cap, all failing the loss-condition validator.
    expect(llm.generateStructured).toHaveBeenCalledTimes(3);
    // No revision written — the current one is not overwritten.
    expect(mockRevCreate).not.toHaveBeenCalled();
  });

  it("does not overwrite the current revision when the judge fails all attempts", async () => {
    const llm = makeLLM({
      content: () => [{ text: "structural weakness", evidenceTier: "INFERRED" }],
      judge: { violations: [{ code: "SWAP_TEST_FAIL", message: "generic" }] },
    });
    const results = await generateBattlecardSections(llm as never, { competitorId: "c1", sectionKeys: ["weaknesses"] });

    expect(results[0]?.status).toBe("REJECTED");
    expect(mockRevCreate).not.toHaveBeenCalled();
  });
});
