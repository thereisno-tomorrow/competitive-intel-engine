// boot-env MUST be first: it wires DATABASE_URL to the direct connection before
// any DB-touching module is imported.
import "./boot-env";

import { prisma } from "@/lib/db";
import { startSchedule, type RunningSchedule } from "./schedule";

/**
 * Boot the worker: start the cron clock and register graceful shutdown.
 *
 * The tick handlers here are placeholders that will be wired to pg-boss job
 * enqueues in U4. Keeping them as thin logging stubs lets U2 land and smoke-test
 * the process lifecycle independently.
 */
export function startWorker(): RunningSchedule {
  console.log("[worker] booting…");

  const schedule = startSchedule({
    onIngestTick: () => {
      console.log("[worker] ingest tick (no-op until U4 wires the job)");
    },
    onGenerateTick: () => {
      console.log("[worker] generate tick (no-op until U4 wires the job)");
    },
  });

  console.log("[worker] clock started (ingest + generate)");
  return schedule;
}

/** Stop the clock and release DB connections. Idempotent-ish; safe on SIGTERM. */
export async function shutdownWorker(schedule: RunningSchedule): Promise<void> {
  console.log("[worker] shutting down…");
  await schedule.stop();
  await prisma.$disconnect();
  console.log("[worker] shutdown complete");
}

function registerSignals(schedule: RunningSchedule): void {
  const handle = (signal: string) => {
    console.log(`[worker] received ${signal}`);
    shutdownWorker(schedule)
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
  const schedule = startWorker();
  registerSignals(schedule);
}
