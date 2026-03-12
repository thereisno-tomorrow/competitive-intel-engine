import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock data ---

const mockAlerts = [
  {
    id: "alert-1",
    type: "SIGNAL_ALERT",
    publishedAt: new Date("2025-06-08T10:00:00Z"),
    headline: "Kyriba launched AI forecasting",
    content: { sections: { whatHappened: "New AI feature" } },
    validationStatus: "PASSED",
    wordCount: 80,
  },
  {
    id: "alert-2",
    type: "SIGNAL_ALERT",
    publishedAt: new Date("2025-06-07T14:00:00Z"),
    headline: "Airwallex expanded licensing",
    content: { sections: { whatHappened: "New license acquired" } },
    validationStatus: "REGENERATED",
    wordCount: 65,
  },
];

// --- Mock prisma ---

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    generatedOutput: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

describe("GET /api/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 with paginated alert list", async () => {
    mockFindMany.mockResolvedValue(mockAlerts);
    mockCount.mockResolvedValue(2);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("total", 2);
    expect(json).toHaveProperty("limit");
    expect(json).toHaveProperty("offset");
    expect(json.items).toHaveLength(2);
  });

  it("returns correct alert item shape", async () => {
    mockFindMany.mockResolvedValue(mockAlerts);
    mockCount.mockResolvedValue(2);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    const response = await GET(request);
    const json = await response.json();

    const item = json.items[0];
    expect(item).toHaveProperty("id", "alert-1");
    expect(item).toHaveProperty("publishedAt", "2025-06-08T10:00:00.000Z");
    expect(item).toHaveProperty("headline");
    expect(item).toHaveProperty("content");
    expect(item).toHaveProperty("wordCount", 80);
    // Should NOT have a "type" field in the alert response
    expect(item).not.toHaveProperty("type");
  });

  it("uses default pagination params (limit=20, offset=0)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(20);
    expect(json.offset).toBe(0);
  });

  it("respects custom limit and offset params", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(10);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts?limit=5&offset=3");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(5);
    expect(json.offset).toBe(3);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        skip: 3,
      }),
    );
  });

  it("clamps limit to max 100", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts?limit=200");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(100);
  });

  it("only queries SIGNAL_ALERT type", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "SIGNAL_ALERT",
          validationStatus: { in: ["PASSED", "REGENERATED"] },
        }),
      }),
    );
  });

  it("orders alerts by publishedAt descending", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { publishedAt: "desc" },
      }),
    );
  });

  it("returns empty items array when no alerts exist", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../alerts/route");
    const request = new NextRequest("http://localhost:3000/api/alerts");
    const response = await GET(request);
    const json = await response.json();

    expect(json.items).toEqual([]);
    expect(json.total).toBe(0);
  });
});
