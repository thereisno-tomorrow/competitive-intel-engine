import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock data ---

const mockPulse = {
  id: "pulse-1",
  type: "WEEKLY_PULSE",
  publishedAt: new Date("2025-06-09T08:00:00Z"),
  headline: "Action Required: Kyriba AI Launch",
  content: { sections: { topSignals: [], claimStatuses: [], outlook: "Stable" } },
  validationStatus: "PASSED",
  wordCount: 120,
};

const mockSignalAlert = {
  id: "alert-1",
  type: "SIGNAL_ALERT",
  publishedAt: new Date("2025-06-08T10:00:00Z"),
  headline: "Kyriba launched AI forecasting",
  content: { sections: { whatHappened: "New AI feature" } },
  validationStatus: "PASSED",
};

// --- Mock prisma ---

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    generatedOutput: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe("GET /api/pulse/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 with latest pulse and signal alerts", async () => {
    mockFindFirst.mockResolvedValue(mockPulse);
    mockFindMany.mockResolvedValue([mockSignalAlert]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("type", "weekly");
    expect(json).toHaveProperty("publishedAt");
    expect(json).toHaveProperty("headline", mockPulse.headline);
    expect(json).toHaveProperty("content");
    expect(json).toHaveProperty("signalAlertsThisWeek");
    expect(json.signalAlertsThisWeek).toBeInstanceOf(Array);
    expect(json.signalAlertsThisWeek).toHaveLength(1);
  });

  it("returns 404 when no pulses exist", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toHaveProperty("error", "No pulses found");
    expect(json).toHaveProperty("code", "not_found");
  });

  it("maps WEEKLY_PULSE type to 'weekly'", async () => {
    mockFindFirst.mockResolvedValue({ ...mockPulse, type: "WEEKLY_PULSE" });
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(json.type).toBe("weekly");
  });

  it("maps MONTHLY_PULSE type to 'monthly'", async () => {
    mockFindFirst.mockResolvedValue({ ...mockPulse, type: "MONTHLY_PULSE" });
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(json.type).toBe("monthly");
  });

  it("returns publishedAt as ISO string", async () => {
    mockFindFirst.mockResolvedValue(mockPulse);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(json.publishedAt).toBe("2025-06-09T08:00:00.000Z");
  });

  it("maps signal alert fields correctly", async () => {
    mockFindFirst.mockResolvedValue(mockPulse);
    mockFindMany.mockResolvedValue([mockSignalAlert]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    const alert = json.signalAlertsThisWeek[0];
    expect(alert).toHaveProperty("id", "alert-1");
    expect(alert).toHaveProperty("headline", "Kyriba launched AI forecasting");
    expect(alert).toHaveProperty("publishedAt", "2025-06-08T10:00:00.000Z");
    expect(alert).toHaveProperty("content");
  });

  it("queries only PASSED and REGENERATED pulses", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { GET } = await import("../pulse/latest/route");
    await GET();

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["WEEKLY_PULSE", "MONTHLY_PULSE"] },
          validationStatus: { in: ["PASSED", "REGENERATED"] },
        }),
        orderBy: { publishedAt: "desc" },
      }),
    );
  });

  it("returns empty signalAlertsThisWeek when no alerts exist", async () => {
    mockFindFirst.mockResolvedValue(mockPulse);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("../pulse/latest/route");
    const response = await GET();
    const json = await response.json();

    expect(json.signalAlertsThisWeek).toEqual([]);
  });
});
