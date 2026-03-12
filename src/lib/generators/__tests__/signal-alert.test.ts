import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SignalAlertContent } from "@/types";

const validContent: SignalAlertContent = {
  sections: {
    whatHappened: "Kyriba launched AI-powered cash forecasting module",
    whyItMatters:
      "Directly challenges the company's AI-native positioning claim with enterprise-grade alternative",
    evidenceTier: "CONFIRMED",
    claimsAffected: ["c1"],
    recommendedResponse:
      "Accelerate MO AI roadmap communications and publish differentiation content",
    actionItems: [
      "Update battlecard for Kyriba",
      "Brief sales team on competitive response",
    ],
    sourceUrls: ["https://kyriba.com/blog/ai-cash-forecasting"],
  },
};

const mockItem = {
  id: "item-alert-1",
  competitorId: "comp-1",
  summary: "Kyriba launched AI cash forecasting",
  evidenceTier: "CONFIRMED",
  type: "PRODUCT_CHANGE",
  rawContent: "Kyriba announces AI-powered cash forecasting...",
  sourceUrl: "https://kyriba.com/blog/ai-cash-forecasting",
  companyImplication: "Challenges AI-native positioning",
  detectedAt: new Date("2025-06-01"),
  alertTriggered: false,
  simulated: false,
  competitor: { name: "Kyriba", tier: "TIER_1" },
};

const mockCreate = vi.fn().mockResolvedValue({ id: "alert-out-1" });
const mockItemFindUnique = vi.fn().mockResolvedValue(mockItem);
const mockClaimFindMany = vi.fn().mockResolvedValue([
  {
    id: "c1",
    claimText: "AI-native treasury intelligence",
    currentStatus: "HOLDING",
  },
]);
const mockOutputFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    intelligenceItem: { findUnique: mockItemFindUnique },
    positioningClaim: { findMany: mockClaimFindMany },
    generatedOutput: { findMany: mockOutputFindMany, create: mockCreate },
  },
}));

const mockLLM = {
  classifyStructured: vi.fn(),
  generateStructured: vi
    .fn()
    .mockResolvedValue(validContent),
};

describe("generateSignalAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.generateStructured.mockResolvedValue(validContent);
    mockItemFindUnique.mockResolvedValue(mockItem);
    mockOutputFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: "alert-out-1" });
  });

  it("generates a valid signal alert and saves to database", async () => {
    const { generateSignalAlert } = await import("../signal-alert");
    const result = await generateSignalAlert(mockLLM, "item-alert-1", [
      "Tier 1 competitor involved",
    ]);

    expect(result).toBeDefined();
    expect(result.id).toBe("alert-out-1");
    expect(result.content.sections.whatHappened).toBeDefined();
    expect(result.content.sections.claimsAffected).toBeInstanceOf(Array);
    expect(result.validationStatus).toBe("PASSED");
  });

  it("fetches the intelligence item with competitor included", async () => {
    const { generateSignalAlert } = await import("../signal-alert");
    await generateSignalAlert(mockLLM, "item-alert-1", [
      "Tier 1 competitor involved",
    ]);

    expect(mockItemFindUnique).toHaveBeenCalledWith({
      where: { id: "item-alert-1" },
      include: { competitor: true },
    });
  });

  it("connects the triggering item to the generated output", async () => {
    const { generateSignalAlert } = await import("../signal-alert");
    await generateSignalAlert(mockLLM, "item-alert-1", [
      "Tier 1 competitor involved",
    ]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "SIGNAL_ALERT",
          intelligenceItems: {
            connect: [{ id: "item-alert-1" }],
          },
        }),
      }),
    );
  });

  it("throws error when intelligence item is not found", async () => {
    mockItemFindUnique.mockResolvedValue(null);

    const { generateSignalAlert } = await import("../signal-alert");
    await expect(
      generateSignalAlert(mockLLM, "nonexistent-id", ["reason"]),
    ).rejects.toThrow("Intelligence item not found: nonexistent-id");
  });

  it("deduplicates — skips generation if alert already exists for this item", async () => {
    mockOutputFindMany.mockResolvedValue([
      { id: "existing-alert", type: "SIGNAL_ALERT" },
    ]);

    const { generateSignalAlert } = await import("../signal-alert");
    const result = await generateSignalAlert(mockLLM, "item-alert-1", [
      "reason",
    ]);

    expect(result.id).toBe("existing-alert");
    expect(mockLLM.generateStructured).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("retries on validation failure and marks as REGENERATED", async () => {
    const invalidContent: SignalAlertContent = {
      sections: {
        whatHappened: "Something happened",
        whyItMatters: "It matters",
        evidenceTier: "CONFIRMED",
        claimsAffected: [],
        recommendedResponse: "Do something",
        actionItems: [],
        sourceUrls: [],
      },
    };

    mockLLM.generateStructured
      .mockResolvedValueOnce(invalidContent)
      .mockResolvedValueOnce(validContent);

    const { generateSignalAlert } = await import("../signal-alert");
    const result = await generateSignalAlert(mockLLM, "item-alert-1", [
      "reason",
    ]);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(2);
    expect(result.validationStatus).toBe("REGENERATED");
  });

  it("rejects after max regeneration attempts", async () => {
    const invalidContent: SignalAlertContent = {
      sections: {
        whatHappened: "Something happened",
        whyItMatters: "It matters",
        evidenceTier: "CONFIRMED",
        claimsAffected: [],
        recommendedResponse: "Do something",
        actionItems: [],
        sourceUrls: [],
      },
    };

    mockLLM.generateStructured.mockResolvedValue(invalidContent);

    const { generateSignalAlert } = await import("../signal-alert");
    const result = await generateSignalAlert(mockLLM, "item-alert-1", [
      "reason",
    ]);

    expect(mockLLM.generateStructured).toHaveBeenCalledTimes(3);
    expect(result.validationStatus).toBe("REJECTED");
  });

  it("includes alert reasons in the headline", async () => {
    const { generateSignalAlert } = await import("../signal-alert");
    const result = await generateSignalAlert(mockLLM, "item-alert-1", [
      "Tier 1 competitor involved",
      "Positioning claim affected",
    ]);

    expect(result.headline).toContain("Kyriba");
  });
});
