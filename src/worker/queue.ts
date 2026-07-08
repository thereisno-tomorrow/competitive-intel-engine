import { PgBoss } from "pg-boss";
import { classifyOutcome } from "./errors";
import { PrismaAttemptStore, type AttemptStore } from "./attempts";
import {
  QUEUES,
  type GenerateCardJobData,
  type GenerateJobData,
  type IngestJobData,
} from "./jobs/types";

/** Minimal job shape the handler wrapper needs (a pg-boss Job is assignable). */
export interface JobLike<T> {
  id: string;
  data: T;
}

/** Minimal boss surface used by enqueue helpers (keeps them unit-testable). */
export interface BossLike {
  send(name: string, data?: object | null, options?: object): Promise<string | null>;
}

/** Retry only infra faults; validation failures never reach here (handler swallows them). */
export const RETRY_POLICY = { retryLimit: 3, retryBackoff: true } as const;

/** Send options for a competitor-level card regen: serialized per competitor via singletonKey. */
export function cardJobOptions(competitorId: string) {
  return { ...RETRY_POLICY, singletonKey: competitorId };
}

// ---------------------------------------------------------------------------
// Enqueue helpers
// ---------------------------------------------------------------------------

export function enqueueIngest(
  boss: BossLike,
  data: IngestJobData = {},
): Promise<string | null> {
  return boss.send(QUEUES.INGEST, data, RETRY_POLICY);
}

export function enqueueGenerate(
  boss: BossLike,
  data: GenerateJobData = {},
): Promise<string | null> {
  return boss.send(QUEUES.GENERATE, data, RETRY_POLICY);
}

/** Two enqueues with the same competitorId collapse to one active job (singleton). */
export function enqueueGenerateCard(
  boss: BossLike,
  competitorId: string,
  reason?: string,
): Promise<string | null> {
  const data: GenerateCardJobData = { competitorId, reason };
  return boss.send(QUEUES.GENERATE_CARD, data, cardJobOptions(competitorId));
}

// ---------------------------------------------------------------------------
// Job handler wrapper — enforces the retry discipline + attempt counter
// ---------------------------------------------------------------------------

export type JobRunner<T> = (
  data: T,
  ctx: { attempt: number },
) => Promise<void>;

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Wrap a job runner into a pg-boss batch handler that:
 *  - reads/increments the persisted attempt counter before running (crash-safe),
 *  - on ValidationRejected: records REJECTED and returns (job completes, NO retry),
 *  - on any other error: records the error and rethrows (pg-boss retries).
 *
 * batchSize is 1 in registration, so each invocation carries a single job.
 */
export function makeBatchHandler<T>(
  queue: string,
  run: JobRunner<T>,
  store: AttemptStore = new PrismaAttemptStore(),
): (jobs: JobLike<T>[]) => Promise<void> {
  return async (jobs: JobLike<T>[]) => {
    for (const job of jobs) {
      const jobKey = `${queue}:${job.id}`;
      const attempt = await store.next(jobKey, queue);
      try {
        await run(job.data, { attempt });
        await store.markStatus(jobKey, "DONE");
      } catch (err) {
        if (classifyOutcome(err) === "reject") {
          await store.markStatus(jobKey, "REJECTED", asMessage(err));
          continue; // do NOT rethrow → job finishes, never retried
        }
        await store.markStatus(jobKey, "PENDING", asMessage(err));
        throw err; // → pg-boss retries (bounded by RETRY_POLICY.retryLimit)
      }
    }
  };
}

// ---------------------------------------------------------------------------
// pg-boss lifecycle (integration; requires a direct Postgres connection)
// ---------------------------------------------------------------------------

/**
 * Construct a pg-boss instance tuned for Neon: its own cron scheduler is OFF
 * (KTD3 — node-cron enqueues instead), on a small pool over the DIRECT
 * (non-pooled) connection (boot-env has already pointed DATABASE_URL at it).
 */
export function createBoss(
  connectionString: string | undefined = process.env.DATABASE_URL,
): PgBoss {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to start the pg-boss queue.");
  }
  return new PgBoss({
    connectionString,
    schedule: false, // KTD3: pg-boss's own scheduler off (Neon-pooler-unsafe)
    max: 5,
  });
}

export interface WorkerHandlers {
  ingest: JobRunner<IngestJobData>;
  generate: JobRunner<GenerateJobData>;
  generateCard: JobRunner<GenerateCardJobData>;
}

/** Create the queues and bind workers. batchSize 1 → one job per handler call. */
export async function registerWorkers(
  boss: PgBoss,
  handlers: WorkerHandlers,
  store: AttemptStore = new PrismaAttemptStore(),
): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name);
  }
  await boss.work(
    QUEUES.INGEST,
    { batchSize: 1 },
    makeBatchHandler(QUEUES.INGEST, handlers.ingest, store),
  );
  await boss.work(
    QUEUES.GENERATE,
    { batchSize: 1 },
    makeBatchHandler(QUEUES.GENERATE, handlers.generate, store),
  );
  // Card writes serialized per competitor via singletonKey + single-fetch batch.
  await boss.work(
    QUEUES.GENERATE_CARD,
    { batchSize: 1 },
    makeBatchHandler(QUEUES.GENERATE_CARD, handlers.generateCard, store),
  );
}
