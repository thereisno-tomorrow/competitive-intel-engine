import { enqueueGenerate, enqueueIngest, type BossLike } from "./queue";
import type { ScheduleHandlers } from "./schedule";

/**
 * The clock enqueues; the worker executes (KTD3). Kept in its own module (no
 * boot-env / DB side effects) so the tick→enqueue wiring is unit-testable.
 */
export function buildScheduleHandlers(boss: BossLike): ScheduleHandlers {
  return {
    onIngestTick: async () => {
      await enqueueIngest(boss);
    },
    onGenerateTick: async () => {
      await enqueueGenerate(boss, { force: false });
    },
  };
}
