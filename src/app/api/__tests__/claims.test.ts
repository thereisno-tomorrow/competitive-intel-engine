import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock data ---

const mockClaims = [
  {
    id: "c1",
    claimText: "Mid-market treasury+payments convergence",
    currentStatus: "HOLDING",
    lastAssessed: new Date("2025-06-01T00:00:00Z"),
    createdAt: new Date("2025-01-01"),
    evidenceItems: [
      { id: "ev1", evidenceTier: "CONFIRMED" },
      { id: "ev2", evidenceTier: "CONFIRMED" },
      { id: "ev3", evidenceTier: "INFERRED" },
    ],
  },
  {
    id: "c2",
    claimText: "AI-native MO AI intelligence",
    currentStatus: "UNDER_PRESSURE",
    lastAssessed: null,
    createdAt: new Date("2025-01-02"),
    evidenceItems: [],
  },
];

const mockClaimWithEvidence = {
  id: "c1",
  claimText: "Mid-market treasury+payments convergence",
  currentStatus: "HOLDING",
  evidenceItems: [
    {
      id: "ev1",
      type: "PRODUCT_CHANGE",
      summary: "Kyriba launched payments module",
      companyImplication: "Validates convergence thesis",
      evidenceTier: "CONFIRMED",
      sourceUrl: "https://kyriba.com/blog",
      simulated: false,
      detectedAt: new Date("2025-06-01T00:00:00Z"),
      competitor: { name: "Kyriba" },
    },
  ],
};

// --- Mock prisma ---

const mockClaimFindMany = vi.fn();
const mockClaimFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    positioningClaim: {
      findMany: (...args: unknown[]) => mockClaimFindMany(...args),
      findUnique: (...args: unknown[]) => mockClaimFindUnique(...args),
    },
  },
}));

describe("GET /api/claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 with all claims", async () => {
    mockClaimFindMany.mockResolvedValue(mockClaims);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toBeInstanceOf(Array);
    expect(json).toHaveLength(2);
  });

  it("returns correct response shape for each claim", async () => {
    mockClaimFindMany.mockResolvedValue(mockClaims);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    const claim = json[0];
    expect(claim).toHaveProperty("id", "c1");
    expect(claim).toHaveProperty("claimText");
    expect(claim).toHaveProperty("status", "HOLDING");
    expect(claim).toHaveProperty("lastAssessed");
    expect(claim).toHaveProperty("evidenceForCount");
    expect(claim).toHaveProperty("evidenceAgainstCount");
  });

  it("counts CONFIRMED evidence as 'for' and non-CONFIRMED as 'against'", async () => {
    mockClaimFindMany.mockResolvedValue(mockClaims);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    const firstClaim = json[0];
    expect(firstClaim.evidenceForCount).toBe(2); // 2 CONFIRMED
    expect(firstClaim.evidenceAgainstCount).toBe(1); // 1 INFERRED
  });

  it("returns zero evidence counts for claims with no evidence", async () => {
    mockClaimFindMany.mockResolvedValue(mockClaims);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    const secondClaim = json[1];
    expect(secondClaim.evidenceForCount).toBe(0);
    expect(secondClaim.evidenceAgainstCount).toBe(0);
  });

  it("returns lastAssessed as ISO string or null", async () => {
    mockClaimFindMany.mockResolvedValue(mockClaims);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    expect(json[0].lastAssessed).toBe("2025-06-01T00:00:00.000Z");
    expect(json[1].lastAssessed).toBeNull();
  });

  it("returns empty array when no claims exist", async () => {
    mockClaimFindMany.mockResolvedValue([]);

    const { GET } = await import("../claims/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("includes only non-simulated evidence in the query", async () => {
    mockClaimFindMany.mockResolvedValue([]);

    const { GET } = await import("../claims/route");
    await GET();

    expect(mockClaimFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          evidenceItems: expect.objectContaining({
            where: { simulated: false },
          }),
        }),
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});

describe("GET /api/claims/[id]/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 with claim detail and evidence", async () => {
    mockClaimFindUnique.mockResolvedValue(mockClaimWithEvidence);

    const { GET } = await import("../claims/[id]/evidence/route");
    const request = new NextRequest("http://localhost:3000/api/claims/c1/evidence");
    const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("claim");
    expect(json).toHaveProperty("evidence");
    expect(json.claim.id).toBe("c1");
    expect(json.evidence).toHaveLength(1);
  });

  it("returns correct evidence item shape", async () => {
    mockClaimFindUnique.mockResolvedValue(mockClaimWithEvidence);

    const { GET } = await import("../claims/[id]/evidence/route");
    const request = new NextRequest("http://localhost:3000/api/claims/c1/evidence");
    const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });
    const json = await response.json();

    const ev = json.evidence[0];
    expect(ev).toHaveProperty("id", "ev1");
    expect(ev).toHaveProperty("competitor", "Kyriba");
    expect(ev).toHaveProperty("type", "PRODUCT_CHANGE");
    expect(ev).toHaveProperty("summary");
    expect(ev).toHaveProperty("companyImplication");
    expect(ev).toHaveProperty("evidenceTier", "CONFIRMED");
    expect(ev).toHaveProperty("sourceUrl");
    expect(ev).toHaveProperty("simulated", false);
    expect(ev).toHaveProperty("detectedAt", "2025-06-01T00:00:00.000Z");
  });

  it("returns 404 when claim does not exist", async () => {
    mockClaimFindUnique.mockResolvedValue(null);

    const { GET } = await import("../claims/[id]/evidence/route");
    const request = new NextRequest("http://localhost:3000/api/claims/nonexistent/evidence");
    const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toHaveProperty("error", "Claim not found");
    expect(json).toHaveProperty("code", "not_found");
  });

  it("returns empty evidence array for claim with no evidence", async () => {
    mockClaimFindUnique.mockResolvedValue({
      ...mockClaimWithEvidence,
      evidenceItems: [],
    });

    const { GET } = await import("../claims/[id]/evidence/route");
    const request = new NextRequest("http://localhost:3000/api/claims/c1/evidence");
    const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.evidence).toEqual([]);
  });
});
