// boot-env MUST be first: it wires DATABASE_URL to the direct connection before
// any DB-touching module is imported.
import "./boot-env";

import { prisma } from "@/lib/db";
import { startSchedule, type RunningSchedule } from "./schedule";
import { createBoss, registerWorkers } from "./queue";
import { buildScheduleHandlers } from "./index-handlers";
import { ingestJob } from "./jobs/ingest";
import { generateJob } from "./jobs/generate";
import type { GenerateCardJobData } from "./jobs/types";
import type { JobRunner } from "./queue";
import type { PgBoss } from "pg-boss";

/**
 * Placeholder card-regen handler. Replaced by the real generator in U16; the
 * generate-card queue isn't enqueued until U17, so a no-op is safe for Phase 1.
 */
const generateCardPlaceholder: JobRunner<GenerateCardJobData> = async (data) => {
  console.log("[job:generate-card] placeholder (U16 wires the generator):", data.competitorId);
};

export interface WorkerRuntime {
  boss: PgBoss;
  schedule: RunningSchedule;
}

/** Boot the worker: start pg-boss, bind workers, start the cron clock. */
export async function startWorker(): Promise<WorkerRuntime> {
  console.log("[worker] booting…");
  const boss = createBoss();
  boss.on("error", (err) => console.error("[worker] pg-boss error:", err));
  await boss.start();

  await registerWorkers(boss, {
    ingest: ingestJob,
    generate: generateJob,
    generateCard: generateCardPlaceholder,
  });

  const schedule = startSchedule(buildScheduleHandlers(boss));
  console.log("[worker] clock started (ingest + generate)");
  return { boss, schedule };
}

/** Stop the clock, drain pg-boss, release DB connections. Safe on SIGTERM. */
export async function shutdownWorker(runtime: WorkerRuntime): Promise<void> {
  console.log("[worker] shutting down…");
  await runtime.schedule.stop();
  await runtime.boss.stop({ graceful: true });
  await prisma.$disconnect();
  console.log("[worker] shutdown complete");
}

function registerSignals(runtime: WorkerRuntime): void {
  const handle = (signal: string) => {
    console.log(`[worker] received ${signal}`);
    shutdownWorker(runtime)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("[worker] shutdown error:", err);
        process.exit(1);
      });
  };
  process.on("SIGTERM", () => handle("SIGTERM"));
  process.on("SIGINT", () => handle("SIGINT"));
}

// Auto-start when run as the process entry (not when imported by a test).
if (process.env.WORKER_AUTOSTART !== "false") {
  startWorker()
    .then((runtime) => registerSignals(runtime))
    .catch((err) => {
      console.error("[worker] failed to start:", err);
      process.exit(1);
    });
}
