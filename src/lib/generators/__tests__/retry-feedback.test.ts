import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRetryFeedbackBlock, buildWeeklyPulsePrompt } from "@/lib/llm/prompts/weekly-pulse";

const mockItemFindMany = vi.fn();
const mockClaimFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    intelligenceItem: { findMany: (...a: unknown[]) => mockItemFindMany(...a) },
    positioningClaim: { findMany: (...a: unknown[]) => mockClaimFindMany(...a) },
    generatedOutput: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

import { generateWeeklyPulse } from "../weekly-pulse";

describe("buildRetryFeedbackBlock", () => {
  it("is empty when there are no previous errors", () => {
    expect(buildRetryFeedbackBlock()).toBe("");
    expect(buildRetryFeedbackBlock([])).toBe("");
  });

  it("lists the specific failure reasons", () => {
    const block = buildRetryFeedbackBlock(["Missing topSignals", "Exceeds word limit: 900 > 800"]);
    expect(block).toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(block).toContain("Missing topSignals");
    expect(block).toContain("Exceeds word limit: 900 > 800");
  });
});

describe("weekly prompt injects previous errors", () => {
  it("includes the reason in the prompt when previousErrors is set", () => {
    const prompt = buildWeeklyPulsePrompt({
      claims: [],
      items: [],
      weekStart: "2026-07-01",
      weekEnd: "2026-07-08",
      previousErrors: ["Signal 0: missing source URL"],
    });
    expect(prompt).toContain("Signal 0: missing source URL");
  });
});

describe("generateWeeklyPulse retry-with-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: "out-1" });
  });

  const validContent = {
    sections: {
      topSignals: [],
      claimStatuses: [],
      outlook: "Stable",
      offensiveOpportunities: [],
    },
  };
  const invalidContent = { sections: { topSignals: [] } }; // missing claimStatuses/outlook

  it("feeds the first attempt's failure reason into the retry prompt and records REGENERATED", async () => {
    const prompts: string[] = [];
    const llm = {
      classifyStructured: vi.fn().mockResolvedValue({ violations: [] }),
      generateStructured: vi.fn(async (prompt: string) => {
        prompts.push(prompt);
        return prompts.length === 1 ? invalidContent : validContent;
      }),
    };

    const result = await generateWeeklyPulse(llm as never);

    expect(llm.generateStructured).toHaveBeenCalledTimes(2);
    // First prompt has no feedback block; second carries the specific reason.
    expect(prompts[0]).not.toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(prompts[1]).toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(prompts[1]).toMatch(/claimStatuses|outlook/); // machine-derived reason
    expect(result.validationStatus).toBe("REGENERATED");
  });

  it("records REJECTED when all attempts fail", async () => {
    const llm = {
      classifyStructured: vi.fn().mockResolvedValue({ violations: [] }),
      generateStructured: vi.fn(async () => invalidContent),
    };

    const result = await generateWeeklyPulse(llm as never);
    expect(result.validationStatus).toBe("REJECTED");
    expect(llm.generateStructured).toHaveBeenCalledTimes(3); // MAX_REGENERATION_ATTEMPTS
  });
});
