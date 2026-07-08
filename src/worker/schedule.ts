import cron, { type ScheduledTask } from "node-cron";

/**
 * The clock only ENQUEUES work; the worker executes it (KTD3). Handlers here are
 * thin: they fire a tick which — in the wired worker — enqueues a pg-boss job.
 */
export interface ScheduleHandlers {
  onIngestTick: () => void | Promise<void>;
  onGenerateTick: () => void | Promise<void>;
}

export interface ScheduleOptions {
  /** Cron expression for the ingest tick. Default: hourly. */
  ingestCron?: string;
  /** Cron expression for the generate tick. Default: every 6 hours. */
  generateCron?: string;
  /** Timezone for cron evaluation. Default: Asia/Singapore (SGT). */
  timezone?: string;
}

export interface RunningSchedule {
  tasks: ScheduledTask[];
  stop: () => Promise<void>;
}

const DEFAULT_INGEST_CRON = "0 * * * *"; // top of every hour
const DEFAULT_GENERATE_CRON = "0 */6 * * *"; // every 6 hours
const DEFAULT_TZ = "Asia/Singapore";

/**
 * Wrap a tick handler so a thrown error is logged and surfaced but never crashes
 * the clock (a bad tick must not take the whole worker down).
 */
export function wrapTick(
  label: string,
  handler: () => void | Promise<void>,
): () => Promise<void> {
  return async () => {
    const startedAt = new Date().toISOString();
    console.log(`[schedule] ${label} tick @ ${startedAt}`);
    try {
      await handler();
    } catch (err) {
      console.error(`[schedule] ${label} tick failed:`, err);
    }
  };
}

/** Start the cron clock. Returns handles for graceful shutdown. */
export function startSchedule(
  handlers: ScheduleHandlers,
  options: ScheduleOptions = {},
): RunningSchedule {
  const tz = options.timezone ?? DEFAULT_TZ;
  const ingest = cron.schedule(
    options.ingestCron ?? DEFAULT_INGEST_CRON,
    wrapTick("ingest", handlers.onIngestTick),
    { timezone: tz, name: "ingest" },
  );
  const generate = cron.schedule(
    options.generateCron ?? DEFAULT_GENERATE_CRON,
    wrapTick("generate", handlers.onGenerateTick),
    { timezone: tz, name: "generate" },
  );

  const tasks = [ingest, generate];
  return {
    tasks,
    stop: async () => {
      // destroy() (not just stop()) fully releases node-cron's internal timers so
      // the process — and vitest's worker forks — can exit cleanly.
      await Promise.all(tasks.map((t) => t.destroy()));
    },
  };
}
