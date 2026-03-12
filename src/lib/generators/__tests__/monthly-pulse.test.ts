import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MonthlyPulseContent } from "@/types";

const validContent: MonthlyPulseContent = {
  sections: {
    categoryHealth: "Treasury management category remains competitive with increasing AI focus.",
    tier1Shifts: [
      {
        competitor: "Kyriba",
        narrative: "Expanding AI treasury capabilities with new forecasting module",
        evidenceTier: "CONFIRMED",
      },
    ],
    tier2Watch: [
      {
        competitor: "GTreasury",
        signal: "Launched mid-market Essentials tier pricing",
      },
    ],
    positioningConfidence: [
      {
        claimId: "c1",
        claimText: "AI-native treasury intelligence",
        status: "UNDER_PRESSURE",
        evidenceForCount: 2,
        evidenceAgainstCount: 3,
        assessment: "Kyriba AI launch puts pressure on this claim.",
      },
    ],
    contentImplications: [
      "Update AI messaging to counter Kyriba claims",
      "Publish case study on multi-jurisdiction licensing",
    ],
  },
};

const mockCreate = vi.fn().mockResolvedValue({ id: "out-monthly-1" });
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
  {
    id: "item-2",
    competitorId: "comp-2",
    summary: "GTreasury Essentials tier",
    evidenceTier: "INFERRED",
    type: "PRICING_CHANGE",
    sourceUrl: "https://gtreasury.com/pricing",
    detectedAt: new Date(),
    simulated: false,
    competitor: { name: "GTreasury", tier: "TIER_2" },
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
  classifyStructured: vi.fn(),
  generateStructured: vi
    .fn()
    .mockResolvedValue(validContent),
};

describe("generateMonthlyPulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      {
        id: "item-2",
        competitorId: "comp-2",
        summary: "GTreasury Essentials tier",
        evidenceTier: "INFERRED",
        type: "PRICING_CHANGE",
        sourceUrl: "https://gtreasury.com/pricing",
        detectedAt: new Date(),
        simulated: false,
        competitor: { name: "GTreasury", tier: "TIER_2" },
      },
    ]);
    mockCreate.mockResolvedValue({ id: "out-monthly-1" });
  });

  it("generates a valid monthly pulse and saves to database", async () => {
    const { generateMonthlyPulse } = await import("../monthly-pulse");
    const result = await generateMonthlyPulse(mockLLM);

    expect(result).toBeDefined();
    expect(result.id).toBe("out-monthly-1");
    expect(result.content.sections.categoryHealth).toBeDefined();
    expect(result.content.sections.positioningConfidence).toBeInstanceOf(Array);
    expect(result.content.sections.contentImplications).toBeInstanceOf(Array);
    expect(result.validationStatus).toBe("PASSED");
  });

  it("queries intelligence items from the past 30 days", async () => {
    const { generateMonthlyPulse } = await import("../monthly-pulse");
    await generateMonthlyPulse(mockLLM);

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { detectedAt: { gte: expect.any(Date) } },
        include: { competitor: true },
        orderBy: { detectedAt: "desc" },
      }),
    );

    // Verify the date is roughly 30 days ago
    const callArgs = mockItemFindMany.mock.calls[0]?.[0] as {
      where: { detectedAt: { gte: Date } };
    };
    const dateDiff = Date.now() - callArgs.where.detectedAt.gte.getTime();
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(29);
    expect(daysDiff).toBeLessThan(31);
  });

  it("connects intelligence items to the generated output", async () => {
    const { generateMonthlyPulse } = await import("../monthly-pulse");
    await generateMonthlyPulse(mockLLM);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "MONTHLY_PULSE",
          intelligenceItems: {
            connect: [{ id: "item-1" }, { id: "item-2" }],
          },
        }),
      }),
    );
  });

  it("includes positioning confidence in headline when claims under pressure", async () => {
    const { generateMonthlyPulse } = await import("../monthly-pulse");
    const result = await generateMonthlyPulse(mockLLM);

    expect(result.headline).toBeDefined();
    expect(typeof result.headline).toBe("string");
  });

  it("retries on validation failure and marks as REGENERATED", async () => {
    const invalidContent: MonthlyPulseContent = {
      sections: {
        categoryHealth: "",
        tier1Shifts: [],
        tier2Watch: [],
        positioningConfidence: [],
        contentImplications: [],
      },
    };

    mockLLM.generateStructured
      .mockResolvedValueOnce(invalidContent)
      .mockResolvedValueOnce(validContent);

    const { generateMonthlyPulse } = await import("../monthly-pulse");
    const result = await generateMonthlyPulse(mockLLM);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(2);
    expect(result.validationStatus).toBe("REGENERATED");
  });

  it("rejects after max regeneration attempts", async () => {
    const invalidContent: MonthlyPulseContent = {
      sections: {
        categoryHealth: "",
        tier1Shifts: [],
        tier2Watch: [],
        positioningConfidence: [],
        contentImplications: [],
      },
    };

    mockLLM.generateStructured.mockResolvedValue(invalidContent);

    const { generateMonthlyPulse } = await import("../monthly-pulse");
    const result = await generateMonthlyPulse(mockLLM);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(3);
    expect(result.validationStatus).toBe("REJECTED");
  });

  it("generates headline for quiet month with zero items", async () => {
    mockItemFindMany.mockResolvedValue([]);
    const quietContent: MonthlyPulseContent = {
      ...validContent,
      sections: {
        ...validContent.sections,
        tier1Shifts: [],
        tier2Watch: [],
      },
    };
    mockLLM.generateStructured.mockResolvedValue(quietContent);

    const { generateMonthlyPulse } = await import("../monthly-pulse");
    const result = await generateMonthlyPulse(mockLLM);

    expect(result.headline).toBe("Quiet Month — No Significant Competitive Activity");
  });
});
