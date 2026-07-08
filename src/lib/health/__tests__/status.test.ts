import { describe, it, expect } from "vitest";
import { classifyWorkerStatus } from "../status";

const INTERVAL = 5 * 60_000; // 5 min
const NOW = new Date("2026-07-08T12:00:00Z");

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("classifyWorkerStatus", () => {
  it("is DEAD when there has never been a heartbeat", () => {
    expect(classifyWorkerStatus(null, NOW, INTERVAL)).toBe("DEAD");
  });

  it("is LIVE within one interval", () => {
    expect(classifyWorkerStatus(ago(0), NOW, INTERVAL)).toBe("LIVE");
    expect(classifyWorkerStatus(ago(INTERVAL - 1), NOW, INTERVAL)).toBe("LIVE");
    expect(classifyWorkerStatus(ago(INTERVAL), NOW, INTERVAL)).toBe("LIVE");
  });

  it("is STALE past 1× and up to 3× the interval", () => {
    expect(classifyWorkerStatus(ago(INTERVAL + 1), NOW, INTERVAL)).toBe("STALE");
    expect(classifyWorkerStatus(ago(INTERVAL * 3), NOW, INTERVAL)).toBe("STALE");
  });

  it("is DEAD past 3× the interval", () => {
    expect(classifyWorkerStatus(ago(INTERVAL * 3 + 1), NOW, INTERVAL)).toBe("DEAD");
    expect(classifyWorkerStatus(ago(INTERVAL * 10), NOW, INTERVAL)).toBe("DEAD");
  });
});
