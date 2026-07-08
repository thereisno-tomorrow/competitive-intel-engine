import { HEARTBEAT } from "@/lib/config/thresholds";

export type WorkerStatus = "LIVE" | "STALE" | "DEAD";

export interface WorkerStatusResult {
  status: WorkerStatus;
  lastHeartbeatAt: string | null;
  ageMs: number | null;
}

/**
 * Pure liveness classifier. LIVE within one interval, STALE past 1×, DEAD past
 * 3× (or if there has never been a heartbeat). "Loud on silence": a dead worker
 * must look different from a quiet news week.
 */
export function classifyWorkerStatus(
  lastHeartbeatAt: Date | null,
  now: Date = new Date(),
  intervalMs: number = HEARTBEAT.INTERVAL_MS,
): WorkerStatus {
  if (!lastHeartbeatAt) return "DEAD";
  const ageMs = now.getTime() - lastHeartbeatAt.getTime();
  if (ageMs <= intervalMs * HEARTBEAT.STALE_MULTIPLIER) return "LIVE";
  if (ageMs <= intervalMs * HEARTBEAT.DEAD_MULTIPLIER) return "STALE";
  return "DEAD";
}
