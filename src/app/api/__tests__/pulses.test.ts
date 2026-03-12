import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock data ---

const mockPulses = [
  {
    id: "pulse-1",
    type: "WEEKLY_PULSE",
    publishedAt: new Date("2025-06-09T08:00:00Z"),
    headline: "Week 23 Pulse",
    content: { sections: {} },
    validationStatus: "PASSED",
    wordCount: 120,
  },
  {
    id: "pulse-2",
    type: "MONTHLY_PULSE",
    publishedAt: new Date("2025-06-01T08:00:00Z"),
    headline: "June Monthly Pulse",
    content: { sections: {} },
    validationStatus: "PASSED",
    wordCount: 250,
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

describe("GET /api/pulses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 with paginated pulse list", async () => {
    mockFindMany.mockResolvedValue(mockPulses);
    mockCount.mockResolvedValue(2);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("total", 2);
    expect(json).toHaveProperty("limit");
    expect(json).toHaveProperty("offset");
    expect(json.items).toHaveLength(2);
  });

  it("returns correct item shape", async () => {
    mockFindMany.mockResolvedValue(mockPulses);
    mockCount.mockResolvedValue(2);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    const response = await GET(request);
    const json = await response.json();

    const item = json.items[0];
    expect(item).toHaveProperty("id", "pulse-1");
    expect(item).toHaveProperty("type", "weekly");
    expect(item).toHaveProperty("publishedAt", "2025-06-09T08:00:00.000Z");
    expect(item).toHaveProperty("headline");
    expect(item).toHaveProperty("content");
    expect(item).toHaveProperty("wordCount", 120);
  });

  it("uses default pagination params (limit=20, offset=0)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(20);
    expect(json.offset).toBe(0);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 0,
      }),
    );
  });

  it("respects custom limit and offset params", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(50);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?limit=10&offset=5");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(10);
    expect(json.offset).toBe(5);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 5,
      }),
    );
  });

  it("clamps limit to max 100", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?limit=500");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(100);
  });

  it("clamps limit to min 1", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?limit=0");
    const response = await GET(request);
    const json = await response.json();

    expect(json.limit).toBe(1);
  });

  it("handles negative offset by clamping to 0", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?offset=-5");
    const response = await GET(request);
    const json = await response.json();

    expect(json.offset).toBe(0);
  });

  it("handles non-numeric limit/offset gracefully", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?limit=abc&offset=xyz");
    const response = await GET(request);
    const json = await response.json();

    // Falls back to defaults when parseInt returns NaN
    expect(json.limit).toBe(20);
    expect(json.offset).toBe(0);
  });

  it("filters by type=weekly", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?type=weekly");
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "WEEKLY_PULSE",
        }),
      }),
    );
  });

  it("filters by type=monthly", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses?type=monthly");
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "MONTHLY_PULSE",
        }),
      }),
    );
  });

  it("returns both types when no type filter specified", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["WEEKLY_PULSE", "MONTHLY_PULSE"] },
        }),
      }),
    );
  });

  it("returns empty items array with total=0 when no data", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    const response = await GET(request);
    const json = await response.json();

    expect(json.items).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("maps MONTHLY_PULSE type to 'monthly' in response", async () => {
    mockFindMany.mockResolvedValue([mockPulses[1]]);
    mockCount.mockResolvedValue(1);

    const { GET } = await import("../pulses/route");
    const request = new NextRequest("http://localhost:3000/api/pulses");
    const response = await GET(request);
    const json = await response.json();

    expect(json.items[0].type).toBe("monthly");
  });
});
