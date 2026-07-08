import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCardFindUnique = vi.fn();
const mockSectionFindMany = vi.fn();
const mockCompetitorFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    competitor: { findFirst: (...a: unknown[]) => mockCompetitorFindFirst(...a) },
    battlecard: { findUnique: (...a: unknown[]) => mockCardFindUnique(...a) },
    battlecardSection: { findMany: (...a: unknown[]) => mockSectionFindMany(...a) },
  },
}));

import { GET } from "../battlecards/[competitorId]/route";

const CID = "ckcompetitor0000000000001"; // cuid-shaped so the name lookup is skipped

function baseCard() {
  return {
    competitor: { id: CID, name: "Kyriba", tier: "TIER_1", reframes: [] },
    whenTheyComeUp: "…",
    theirPitch: [],
    weaknesses: [{ text: "baseline weakness", evidenceTier: "INFERRED", sourceUrl: "u" }],
    openQuestions: ["baseline question?"],
    overview: null,
    quickDismiss: null,
    whyWeWin: [],
    whyWeLose: [],
    trapQuestions: [],
    proofPoints: [],
    updatedAt: new Date("2026-07-08T00:00:00Z"),
  };
}

function req() {
  return new NextRequest(`http://localhost/api/battlecards/${CID}`);
}

describe("GET /api/battlecards/[competitorId] — living revisions (U18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCardFindUnique.mockResolvedValue(baseCard());
  });

  it("overlays the latest PASSED/REGENERATED revision per section", async () => {
    mockSectionFindMany.mockResolvedValue([
      {
        sectionKey: "weaknesses",
        revisions: [
          { validationStatus: "PASSED", createdAt: new Date(1000), content: [{ text: "rev1 weakness", evidenceTier: "INFERRED", sourceUrl: "u" }] },
          { validationStatus: "REGENERATED", createdAt: new Date(2000), content: [{ text: "rev2 weakness", evidenceTier: "CONFIRMED", sourceUrl: "u2" }] },
        ],
      },
    ]);

    const res = await GET(req(), { params: Promise.resolve({ competitorId: CID }) });
    const json = await res.json();
    // The newer REGENERATED revision wins, replacing the baseline.
    expect(json.weaknesses[0].text).toBe("rev2 weakness");
  });

  it("keeps the last passing revision when the newest is FLAGGED", async () => {
    mockSectionFindMany.mockResolvedValue([
      {
        sectionKey: "weaknesses",
        revisions: [
          { validationStatus: "PASSED", createdAt: new Date(1000), content: [{ text: "good weakness", evidenceTier: "INFERRED", sourceUrl: "u" }] },
          { validationStatus: "FLAGGED", createdAt: new Date(3000), content: [{ text: "flagged weakness", evidenceTier: "CONFIRMED", sourceUrl: "u3" }] },
        ],
      },
    ]);

    const res = await GET(req(), { params: Promise.resolve({ competitorId: CID }) });
    const json = await res.json();
    expect(json.weaknesses[0].text).toBe("good weakness");
  });

  it("falls back to the static card when a section has no revisions", async () => {
    mockSectionFindMany.mockResolvedValue([]);
    const res = await GET(req(), { params: Promise.resolve({ competitorId: CID }) });
    const json = await res.json();
    expect(json.weaknesses[0].text).toBe("baseline weakness");
    expect(json.openQuestions).toEqual(["baseline question?"]);
  });
});
