import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    generatedOutput: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    intelligenceItem: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

const mockWeekly = vi.fn();
const mockMonthly = vi.fn();
const mockAlert = vi.fn();
const mockEvaluate = vi.fn();

vi.mock("../weekly-pulse", () => ({ generateWeeklyPulse: (...a: unknown[]) => mockWeekly(...a) }));
vi.mock("../monthly-pulse", () => ({ generateMonthlyPulse: (...a: unknown[]) => mockMonthly(...a) }));
vi.mock("../signal-alert", () => ({ generateSignalAlert: (...a: unknown[]) => mockAlert(...a) }));
vi.mock("@/lib/synthesis/alert-evaluator", () => ({
  evaluateAlertThreshold: (...a: unknown[]) => mockEvaluate(...a),
}));

import { runGeneratePipeline } from "../generate-pipeline";

const llm = {} as never;

describe("runGeneratePipeline (characterization)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockEvaluate.mockReturnValue({ shouldAlert: false, reasons: [] });
  });

  it("returns the stable result shape", async () => {
    const result = await runGeneratePipeline(llm, { pulseOnly: true });
    expect(result).toEqual({ signalAlerts: [], weeklyPulse: null, monthlyPulse: null });
  });

  it("force=true generates both pulses and reports their ids", async () => {
    mockWeekly.mockResolvedValue({ id: "w1", headline: "Weekly" });
    mockMonthly.mockResolvedValue({ id: "m1", headline: "Monthly" });

    const result = await runGeneratePipeline(llm, { force: true, pulseOnly: true });

    expect(mockWeekly).toHaveBeenCalledOnce();
    expect(mockMonthly).toHaveBeenCalledOnce();
    expect(result.weeklyPulse).toEqual({ id: "w1", headline: "Weekly" });
    expect(result.monthlyPulse).toEqual({ id: "m1", headline: "Monthly" });
  });

  it("generates a signal alert for an item over threshold", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "i1",
        rawContent: "x",
        type: "PRICING_CHANGE",
        competitor: { tier: "TIER_1" },
        claimsAffected: [],
      },
    ]);
    mockEvaluate.mockReturnValue({ shouldAlert: true, reasons: ["pricing"] });
    mockAlert.mockResolvedValue({ id: "a1", headline: "Alert", deduplicated: false });

    const result = await runGeneratePipeline(llm, { force: false });

    expect(mockAlert).toHaveBeenCalledWith(llm, "i1", ["pricing"]);
    expect(result.signalAlerts).toEqual([
      { id: "a1", headline: "Alert", deduplicated: false },
    ]);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { alertTriggered: true },
    });
  });

  it("pulseOnly skips the signal-alert loop entirely", async () => {
    await runGeneratePipeline(llm, { pulseOnly: true });
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
