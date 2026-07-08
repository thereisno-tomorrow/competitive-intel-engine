import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWorkerDatabaseUrl } from "../boot-env";
import {
  startSchedule,
  wrapTick,
  type RunningSchedule,
} from "../schedule";

let running: RunningSchedule | null = null;

afterEach(async () => {
  if (running) {
    await running.stop();
    running = null;
  }
});

describe("resolveWorkerDatabaseUrl", () => {
  it("returns a valid direct connection string", () => {
    const url = "postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/db";
    expect(
      resolveWorkerDatabaseUrl({ WORKER_DATABASE_URL_DIRECT: url } as unknown as NodeJS.ProcessEnv),
    ).toBe(url);
  });

  it("throws when unset", () => {
    expect(() =>
      resolveWorkerDatabaseUrl({} as unknown as NodeJS.ProcessEnv),
    ).toThrow(/WORKER_DATABASE_URL_DIRECT is required/);
  });

  it("throws when pointed at a pooler host", () => {
    const url = "postgresql://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db";
    expect(() =>
      resolveWorkerDatabaseUrl({
        WORKER_DATABASE_URL_DIRECT: url,
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/pooler/);
  });
});

describe("wrapTick", () => {
  it("invokes the handler", async () => {
    const handler = vi.fn();
    await wrapTick("test", handler)();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("swallows a thrown error (clock survives a bad tick)", async () => {
    const handler = vi.fn(() => {
      throw new Error("boom");
    });
    await expect(wrapTick("test", handler)()).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("startSchedule (smoke)", () => {
  it("registers ingest + generate tasks and fires a tick once on execute", async () => {
    const onIngestTick = vi.fn();
    const onGenerateTick = vi.fn();
    running = startSchedule({ onIngestTick, onGenerateTick });

    expect(running.tasks).toHaveLength(2);

    const ingestTask = running.tasks[0]!;
    await ingestTask.execute();
    expect(onIngestTick).toHaveBeenCalledOnce();
    expect(onGenerateTick).not.toHaveBeenCalled();
  });

  it("stops cleanly", async () => {
    running = startSchedule({ onIngestTick: vi.fn(), onGenerateTick: vi.fn() });
    await expect(running.stop()).resolves.toBeUndefined();
    running = null;
  });
});
