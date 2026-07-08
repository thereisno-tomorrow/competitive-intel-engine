import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock ingestion runner ---

const mockRunnerRun = vi.fn().mockResolvedValue({
  sourcesChecked: 5,
  changesDetected: 2,
  itemsCreated: 2,
  errors: [],
});

vi.mock("@/lib/ingestion/runner", () => ({
  IngestionRunner: class {
    run = mockRunnerRun;
  },
}));

vi.mock("@/lib/ingestion/adapters/html-page", () => ({
  WebsiteAdapter: vi.fn(),
  ChangelogAdapter: vi.fn(),
  StatusPageAdapter: vi.fn(),
}));

vi.mock("@/lib/ingestion/adapters/rss", () => ({
  RssAdapter: vi.fn(),
}));

vi.mock("@/lib/ingestion/adapters/linkedin", () => ({
  LinkedInAdapter: vi.fn(),
}));

// --- Mock prisma for generate route ---

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    generatedOutput: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    intelligenceItem: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/synthesis/alert-evaluator", () => ({
  evaluateAlertThreshold: vi.fn().mockReturnValue({
    shouldAlert: false,
    reasons: [],
  }),
}));

vi.mock("@/lib/generators/signal-alert", () => ({
  generateSignalAlert: vi.fn(),
}));

vi.mock("@/lib/generators/weekly-pulse", () => ({
  generateWeeklyPulse: vi.fn(),
}));

vi.mock("@/lib/generators/monthly-pulse", () => ({
  generateMonthlyPulse: vi.fn(),
}));

vi.mock("@/lib/llm/factory", () => ({
  createLLMProvider: vi.fn(() => ({})),
}));

vi.mock("@/lib/config/thresholds", () => ({
  SCHEDULE: {
    SGT_OFFSET_HOURS: 8,
    WEEKLY_PULSE_DAY: 1,
    MONTHLY_PULSE_MAX_BUSINESS_DAY: 5,
  },
}));

describe("POST /api/cron/ingest", () => {
  const CRON_SECRET = "test-cron-secret-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const { POST } = await import("../cron/ingest/route");
    const request = new NextRequest("http://localhost:3000/api/cron/ingest", {
      method: "POST",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toHaveProperty("error", "Unauthorized");
    expect(json).toHaveProperty("code", "unauthorized");
  });

  it("returns 401 when bearer token is wrong", async () => {
    const { POST } = await import("../cron/ingest/route");
    const request = new NextRequest("http://localhost:3000/api/cron/ingest", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toHaveProperty("error", "Unauthorized");
  });

  it("returns 401 when authorization is not Bearer format", async () => {
    const { POST } = await import("../cron/ingest/route");
    const request = new NextRequest("http://localhost:3000/api/cron/ingest", {
      method: "POST",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 200 with ingestion result on valid auth", async () => {
    const { POST } = await import("../cron/ingest/route");
    const request = new NextRequest("http://localhost:3000/api/cron/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("sourcesChecked", 5);
    expect(json).toHaveProperty("changesDetected", 2);
    expect(json).toHaveProperty("itemsCreated", 2);
    expect(json).toHaveProperty("errors");
  });
});

describe("POST /api/cron/generate", () => {
  const CRON_SECRET = "test-cron-secret-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = CRON_SECRET;
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);
  });

  it("returns 401 when authorization header is missing", async () => {
    const { POST } = await import("../cron/generate/route");
    const request = new NextRequest("http://localhost:3000/api/cron/generate", {
      method: "POST",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toHaveProperty("error", "Unauthorized");
    expect(json).toHaveProperty("code", "unauthorized");
  });

  it("returns 401 when bearer token is wrong", async () => {
    const { POST } = await import("../cron/generate/route");
    const request = new NextRequest("http://localhost:3000/api/cron/generate", {
      method: "POST",
      headers: { authorization: "Bearer bad-token" },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 200 with generate result on valid auth", async () => {
    const { POST } = await import("../cron/generate/route");
    const request = new NextRequest("http://localhost:3000/api/cron/generate", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("signalAlerts");
    expect(json.signalAlerts).toBeInstanceOf(Array);
    expect(json).toHaveProperty("weeklyPulse");
    expect(json).toHaveProperty("monthlyPulse");
  });

  it("returns null for weeklyPulse and monthlyPulse when not scheduled", async () => {
    const { POST } = await import("../cron/generate/route");
    const request = new NextRequest("http://localhost:3000/api/cron/generate", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const response = await POST(request);
    const json = await response.json();

    // Since no unprocessed items, no alerts should be generated either
    expect(json.signalAlerts).toEqual([]);
  });
});
