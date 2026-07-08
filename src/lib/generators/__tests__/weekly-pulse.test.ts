import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WeeklyPulseContent } from "@/types";

const validContent: WeeklyPulseContent = {
  sections: {
    topSignals: [
      {
        competitor: "Kyriba",
        summary: "Launched AI cash forecasting",
        implication: "Directly challenges MO AI positioning",
        evidenceTier: "CONFIRMED",
        sourceUrl: "https://kyriba.com/blog",
      },
    ],
    claimStatuses: [
      {
        claimId: "c1",
        claimText: "AI-native treasury intelligence",
        status: "UNDER_PRESSURE",
        changeFromLastWeek: "degraded",
      },
    ],
    actionRequired: "Review MO AI messaging in light of Kyriba AI launch",
    outlook: "Competitive pressure increasing on AI positioning.",
  },
};

const mockCreate = vi.fn().mockResolvedValue({ id: "out-1" });
const mockItemFindMany = vi.fn().mockResolvedValue([
  {
    id: "item-1",
    competitorId: "comp-1",
    summary: "Kyriba AI launch",
    evidenceTier: "CONFIRMED",
    type: "PRODUCT_CHANGE",
    sourceUrl: "https://kyriba.com/blog",
    detectedAt: new Date(),
    simulated: false,
    competitor: { name: "Kyriba", tier: "TIER_1" },
  },
]);
const mockClaimFindMany = vi.fn().mockResolvedValue([
  {
    id: "c1",
    claimText: "AI-native treasury intelligence",
    currentStatus: "HOLDING",
  },
]);

vi.mock("@/lib/db", () => ({
  prisma: {
    intelligenceItem: { findMany: mockItemFindMany },
    positioningClaim: { findMany: mockClaimFindMany },
    generatedOutput: { create: mockCreate },
  },
}));

const mockLLM = {
  // Judge call (step: "judge") — default to a clean pass (no violations).
  classifyStructured: vi.fn().mockResolvedValue({ violations: [] }),
  generateStructured: vi
    .fn()
    .mockResolvedValue(validContent),
};

describe("generateWeeklyPulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.classifyStructured.mockResolvedValue({ violations: [] });
    mockLLM.generateStructured.mockResolvedValue(validContent);
    mockItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        competitorId: "comp-1",
        summary: "Kyriba AI launch",
        evidenceTier: "CONFIRMED",
        type: "PRODUCT_CHANGE",
        sourceUrl: "https://kyriba.com/blog",
        detectedAt: new Date(),
        simulated: false,
        competitor: { name: "Kyriba", tier: "TIER_1" },
      },
    ]);
    mockCreate.mockResolvedValue({ id: "out-1" });
  });

  it("generates a valid weekly pulse and saves to database", async () => {
    const { generateWeeklyPulse } = await import("../weekly-pulse");
    const result = await generateWeeklyPulse(mockLLM);

    expect(result).toBeDefined();
    expect(result.id).toBe("out-1");
    expect(result.headline).toBeDefined();
    expect(result.content.sections).toBeDefined();
    expect(result.content.sections.topSignals).toBeInstanceOf(Array);
    expect(result.content.sections.claimStatuses).toBeInstanceOf(Array);
    expect(result.validationStatus).toBe("PASSED");
  });

  it("queries intelligence items from the past 7 days", async () => {
    const { generateWeeklyPulse } = await import("../weekly-pulse");
    await generateWeeklyPulse(mockLLM);

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventDate: { gte: expect.any(Date) }, simulated: false },
        include: { competitor: true },
        orderBy: { eventDate: "desc" },
      }),
    );
  });

  it("connects intelligence items to the generated output", async () => {
    const { generateWeeklyPulse } = await import("../weekly-pulse");
    await generateWeeklyPulse(mockLLM);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "WEEKLY_PULSE",
          intelligenceItems: {
            connect: [{ id: "item-1" }],
          },
        }),
      }),
    );
  });

  it("generates headline from actionRequired when present", async () => {
    const { generateWeeklyPulse } = await import("../weekly-pulse");
    const result = await generateWeeklyPulse(mockLLM);

    expect(result.headline).toContain("Action Required");
  });

  it("generates headline for zero items when no items and no action", async () => {
    mockItemFindMany.mockResolvedValue([]);
    mockLLM.generateStructured.mockResolvedValue({
      ...validContent,
      sections: {
        ...validContent.sections,
        actionRequired: null,
      },
    });

    const { generateWeeklyPulse } = await import("../weekly-pulse");
    const result = await generateWeeklyPulse(mockLLM);

    expect(result.headline).toBe("Nothing Notable This Week");
  });

  it("retries on validation failure and marks as REGENERATED", async () => {
    const invalidContent: WeeklyPulseContent = {
      sections: {
        topSignals: [
          {
            competitor: "Kyriba",
            summary: "x",
            implication: "y",
            // @ts-expect-error -- testing invalid input
            evidenceTier: undefined,
            sourceUrl: "https://kyriba.com",
          },
        ],
        claimStatuses: [],
        actionRequired: null,
        outlook: "ok",
      },
    };

    mockLLM.generateStructured
      .mockResolvedValueOnce(invalidContent)
      .mockResolvedValueOnce(validContent);

    const { generateWeeklyPulse } = await import("../weekly-pulse");
    const result = await generateWeeklyPulse(mockLLM);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(2);
    expect(result.validationStatus).toBe("REGENERATED");
  });

  it("rejects after max regeneration attempts", async () => {
    const invalidContent: WeeklyPulseContent = {
      sections: {
        topSignals: [
          {
            competitor: "Kyriba",
            summary: "x",
            implication: "y",
            // @ts-expect-error -- testing invalid input
            evidenceTier: undefined,
            sourceUrl: "https://kyriba.com",
          },
        ],
        claimStatuses: [],
        actionRequired: null,
        outlook: "ok",
      },
    };

    mockLLM.generateStructured.mockResolvedValue(invalidContent);

    const { generateWeeklyPulse } = await import("../weekly-pulse");
    const result = await generateWeeklyPulse(mockLLM);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(3);
    expect(result.validationStatus).toBe("REJECTED");
  });
});
