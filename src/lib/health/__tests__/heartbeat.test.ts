import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    workerHeartbeat: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      create: (...a: unknown[]) => mockCreate(...a),
    },
  },
}));

import { getWorkerStatus, pingHealthcheck, writeHeartbeat } from "../heartbeat";

describe("pingHealthcheck", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.HEALTHCHECK_PING_URL;
  });

  it("does nothing (no fetch, no error) when HEALTHCHECK_PING_URL is unset", async () => {
    delete process.env.HEALTHCHECK_PING_URL;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    await expect(pingHealthcheck()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pings the URL when set", async () => {
    process.env.HEALTHCHECK_PING_URL = "https://hc-ping.com/abc";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as never;
    await pingHealthcheck();
    expect(fetchSpy).toHaveBeenCalledWith("https://hc-ping.com/abc", { method: "POST" });
  });

  it("swallows a ping failure (never fails the job)", async () => {
    process.env.HEALTHCHECK_PING_URL = "https://hc-ping.com/abc";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as never;
    await expect(pingHealthcheck()).resolves.toBeUndefined();
  });
});

describe("getWorkerStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns DEAD with null age when there are no heartbeats", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await getWorkerStatus();
    expect(result.status).toBe("DEAD");
    expect(result.lastHeartbeatAt).toBeNull();
    expect(result.ageMs).toBeNull();
  });

  it("returns LIVE for a fresh heartbeat", async () => {
    mockFindFirst.mockResolvedValue({ beatAt: new Date() });
    const result = await getWorkerStatus();
    expect(result.status).toBe("LIVE");
    expect(result.lastHeartbeatAt).not.toBeNull();
    expect(result.ageMs).toBeGreaterThanOrEqual(0);
  });
});

describe("writeHeartbeat", () => {
  beforeEach(() => vi.clearAllMocks());
  it("creates a heartbeat row", async () => {
    mockCreate.mockResolvedValue({ id: "hb-1" });
    await writeHeartbeat("boot");
    expect(mockCreate).toHaveBeenCalledWith({ data: { note: "boot" } });
  });
});
