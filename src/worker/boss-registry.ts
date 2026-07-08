import type { BossLike } from "./queue";

/**
 * Process-scoped reference to the running pg-boss instance, so jobs (e.g. ingest)
 * can enqueue follow-on jobs (e.g. card-regen retarget, U17) without threading the
 * boss through every JobRunner signature. Set once at worker boot.
 */
let active: BossLike | null = null;

export function setActiveBoss(boss: BossLike): void {
  active = boss;
}

export function getActiveBoss(): BossLike | null {
  return active;
}
