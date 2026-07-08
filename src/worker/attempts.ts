import { prisma } from "@/lib/db";
import type { JobRunStatus } from "@/generated/prisma/client";

/**
 * Persisted attempt counter (R2). Read/incremented in the DB *before* each
 * expensive attempt so a crash mid-attempt resumes at N+1 instead of restarting
 * at 1 (and never double-spends silently).
 */
export interface AttemptStore {
  /** Atomically increment and return the new attempt number for this job identity. */
  next(jobKey: string, queue: string): Promise<number>;
  /** Record terminal/interim status for observability. */
  markStatus(jobKey: string, status: JobRunStatus, error?: string): Promise<void>;
}

/** Prisma-backed store using the JobRun table. */
export class PrismaAttemptStore implements AttemptStore {
  async next(jobKey: string, queue: string): Promise<number> {
    const row = await prisma.jobRun.upsert({
      where: { jobKey },
      create: { jobKey, queue, attempt: 1, status: "RUNNING" },
      update: { attempt: { increment: 1 }, status: "RUNNING" },
    });
    return row.attempt;
  }

  async markStatus(
    jobKey: string,
    status: JobRunStatus,
    error?: string,
  ): Promise<void> {
    await prisma.jobRun.update({
      where: { jobKey },
      data: { status, lastError: error ?? null },
    });
  }
}

/** In-memory store for tests. Persistence is simulated by reusing the backing map. */
export class InMemoryAttemptStore implements AttemptStore {
  constructor(
    private readonly rows: Map<
      string,
      { queue: string; attempt: number; status: JobRunStatus; lastError?: string }
    > = new Map(),
  ) {}

  async next(jobKey: string, queue: string): Promise<number> {
    const existing = this.rows.get(jobKey);
    const attempt = (existing?.attempt ?? 0) + 1;
    this.rows.set(jobKey, {
      queue,
      attempt,
      status: "RUNNING",
      lastError: existing?.lastError,
    });
    return attempt;
  }

  async markStatus(
    jobKey: string,
    status: JobRunStatus,
    error?: string,
  ): Promise<void> {
    const existing = this.rows.get(jobKey);
    if (existing) {
      existing.status = status;
      existing.lastError = error;
    }
  }
}
