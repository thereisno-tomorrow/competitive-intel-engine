import { describe, expect, it, vi } from "vitest";
import { classifyOutcome, InfraFault, ValidationRejected } from "../errors";
import { InMemoryAttemptStore } from "../attempts";
import {
  cardJobOptions,
  enqueueGenerateCard,
  makeBatchHandler,
  RETRY_POLICY,
  type BossLike,
  type JobLike,
} from "../queue";
import { QUEUES } from "../jobs/types";

describe("classifyOutcome", () => {
  it("marks ValidationRejected as reject (no retry)", () => {
    expect(classifyOutcome(new ValidationRejected("bad", ["x"]))).toBe("reject");
  });
  it("marks InfraFault as retry", () => {
    expect(classifyOutcome(new InfraFault("429"))).toBe("retry");
  });
  it("marks unknown errors as retry", () => {
    expect(classifyOutcome(new Error("boom"))).toBe("retry");
  });
});

function job<T>(id: string, data: T): JobLike<T> {
  return { id, data };
}

describe("makeBatchHandler retry discipline", () => {
  it("a ValidationRejected job is recorded REJECTED and does NOT throw (no retry)", async () => {
    const store = new InMemoryAttemptStore();
    const markSpy = vi.spyOn(store, "markStatus");
    const handler = makeBatchHandler<{ n: number }>(
      "q",
      async () => {
        throw new ValidationRejected("nope", ["r1"]);
      },
      store,
    );
    await expect(handler([job("j1", { n: 1 })])).resolves.toBeUndefined();
    expect(markSpy).toHaveBeenCalledWith("q:j1", "REJECTED", "nope");
  });

  it("an InfraFault job rethrows so pg-boss retries", async () => {
    const store = new InMemoryAttemptStore();
    const handler = makeBatchHandler<{ n: number }>(
      "q",
      async () => {
        throw new InfraFault("timeout");
      },
      store,
    );
    await expect(handler([job("j2", { n: 1 })])).rejects.toBeInstanceOf(InfraFault);
  });

  it("a successful job is recorded DONE", async () => {
    const store = new InMemoryAttemptStore();
    const markSpy = vi.spyOn(store, "markStatus");
    const run = vi.fn(async () => {});
    const handler = makeBatchHandler("q", run, store);
    await handler([job("j3", {})]);
    expect(run).toHaveBeenCalledOnce();
    expect(markSpy).toHaveBeenCalledWith("q:j3", "DONE");
  });
});

describe("attempt counter crash resume", () => {
  it("resumes at N+1 across a simulated crash (same job id, shared backing store)", async () => {
    // A shared backing map simulates the DB surviving a process crash.
    const backing = new Map<
      string,
      { queue: string; attempt: number; status: "RUNNING"; lastError?: string }
    >();
    const attempts: number[] = [];

    // Run 1: crashes after attempt 2 (InfraFault twice).
    const store1 = new InMemoryAttemptStore(
      backing as unknown as ConstructorParameters<typeof InMemoryAttemptStore>[0],
    );
    const crashing = makeBatchHandler<object>(
      "q",
      async (_data, { attempt }) => {
        attempts.push(attempt);
        throw new InfraFault(`crash on attempt ${attempt}`);
      },
      store1,
    );
    await expect(crashing([job("same-id", {})])).rejects.toBeInstanceOf(InfraFault);
    await expect(crashing([job("same-id", {})])).rejects.toBeInstanceOf(InfraFault);
    expect(attempts).toEqual([1, 2]);

    // Run 2: a fresh store over the SAME backing map ("process restarted").
    const store2 = new InMemoryAttemptStore(
      backing as unknown as ConstructorParameters<typeof InMemoryAttemptStore>[0],
    );
    let resumedAttempt = 0;
    const resuming = makeBatchHandler<object>(
      "q",
      async (_data, { attempt }) => {
        resumedAttempt = attempt;
      },
      store2,
    );
    await resuming([job("same-id", {})]);
    expect(resumedAttempt).toBe(3); // resumes at N+1, not 1
  });
});

describe("enqueue helpers + singleton", () => {
  it("enqueueGenerateCard sends with singletonKey = competitorId and retry policy", async () => {
    const sends: { name: string; data?: object | null; options?: object }[] = [];
    const boss: BossLike = {
      send: vi.fn(async (name, data, options) => {
        sends.push({ name, data, options });
        return "job-id";
      }),
    };
    await enqueueGenerateCard(boss, "comp-123", "pricing change");
    expect(sends[0]?.name).toBe(QUEUES.GENERATE_CARD);
    expect(sends[0]?.options).toEqual({
      retryLimit: 3,
      retryBackoff: true,
      singletonKey: "comp-123",
    });
  });

  it("cardJobOptions carries the retry policy", () => {
    expect(cardJobOptions("c1")).toEqual({ ...RETRY_POLICY, singletonKey: "c1" });
  });
});
