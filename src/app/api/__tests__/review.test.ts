import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    generatedOutput: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

describe("GET /api/review (flagged queue)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns only FLAGGED outputs with their judge warnings", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "o1",
        type: "WEEKLY_PULSE",
        headline: "Borderline pulse",
        publishedAt: new Date("2026-07-08T00:00:00Z"),
        content: {},
        rubricVersion: "1.0.0",
        judgeVerdict: { pass: true, violations: [], warnings: [{ code: "SOFT", message: "x" }] },
      },
    ]);
    const { GET } = await import("../review/route");
    const res = await GET();
    const json = await res.json();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { validationStatus: "FLAGGED" } }),
    );
    expect(json.items).toHaveLength(1);
    expect(json.items[0].judgeVerdict.warnings[0].code).toBe("SOFT");
  });
});

describe("PATCH /api/review/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFindUnique.mockResolvedValue({ id: "o1", validationStatus: "FLAGGED" });
  });

  function patch(action: unknown) {
    return new NextRequest("http://localhost/api/review/o1", {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
  }

  it("approve → PASSED (publishes)", async () => {
    mockUpdate.mockResolvedValue({ id: "o1", validationStatus: "PASSED" });
    const { PATCH } = await import("../review/[id]/route");
    const res = await PATCH(patch("approve"), { params: Promise.resolve({ id: "o1" }) });
    const json = await res.json();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { validationStatus: "PASSED" },
    });
    expect(json.validationStatus).toBe("PASSED");
  });

  it("reject → REJECTED (hidden)", async () => {
    mockUpdate.mockResolvedValue({ id: "o1", validationStatus: "REJECTED" });
    const { PATCH } = await import("../review/[id]/route");
    const res = await PATCH(patch("reject"), { params: Promise.resolve({ id: "o1" }) });
    const json = await res.json();
    expect(json.validationStatus).toBe("REJECTED");
  });

  it("rejects an invalid action with 400", async () => {
    const { PATCH } = await import("../review/[id]/route");
    const res = await PATCH(patch("frobnicate"), { params: Promise.resolve({ id: "o1" }) });
    expect(res.status).toBe(400);
  });

  it("409 when the output is not flagged", async () => {
    mockFindUnique.mockResolvedValue({ id: "o1", validationStatus: "PASSED" });
    const { PATCH } = await import("../review/[id]/route");
    const res = await PATCH(patch("approve"), { params: Promise.resolve({ id: "o1" }) });
    expect(res.status).toBe(409);
  });
});
