// boot-env MUST be first: it wires DATABASE_URL to the direct connection before
// any DB-touching module is imported.
import "./boot-env";

import { prisma } from "@/lib/db";
import { startSchedule, type RunningSchedule } from "./schedule";
import { createBoss, registerWorkers } from "./queue";
import { buildScheduleHandlers } from "./index-handlers";
import { ingestJob } from "./jobs/ingest";
import { generateJob } from "./jobs/generate";
import { generateCardJob } from "./jobs/generate-card";
import { writeHeartbeat } from "@/lib/health/heartbeat";
import { HEARTBEAT } from "@/lib/config/thresholds";
import type { PgBoss } from "pg-boss";

export interface WorkerRuntime {
  boss: PgBoss;
  schedule: RunningSchedule;
  heartbeat: NodeJS.Timeout;
}

/** Boot the worker: start pg-boss, bind workers, start the cron clock + heartbeat. */
export async function startWorker(): Promise<WorkerRuntime> {
  console.log("[worker] booting…");
  const boss = createBoss();
  boss.on("error", (err) => console.error("[worker] pg-boss error:", err));
  await boss.start();

  await registerWorkers(boss, {
    ingest: ingestJob,
    generate: generateJob,
    generateCard: generateCardJob,
  });

  const schedule = startSchedule(buildScheduleHandlers(boss));

  // Liveness heartbeat: write immediately, then on an interval (U6).
  await writeHeartbeat("boot").catch((err) =>
    console.error("[worker] heartbeat write failed:", err),
  );
  const heartbeat = setInterval(() => {
    writeHeartbeat().catch((err) =>
      console.error("[worker] heartbeat write failed:", err),
    );
  }, HEARTBEAT.INTERVAL_MS);
  heartbeat.unref?.();

  console.log("[worker] clock + heartbeat started (ingest + generate)");
  return { boss, schedule, heartbeat };
}

/** Stop the clock, drain pg-boss, release DB connections. Safe on SIGTERM. */
export async function shutdownWorker(runtime: WorkerRuntime): Promise<void> {
  console.log("[worker] shutting down…");
  clearInterval(runtime.heartbeat);
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
