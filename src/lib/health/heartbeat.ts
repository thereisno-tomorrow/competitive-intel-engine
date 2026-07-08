import { prisma } from "@/lib/db";
import { classifyWorkerStatus, type WorkerStatusResult } from "./status";

/** Append a heartbeat row. Called by the worker on an interval. */
export async function writeHeartbeat(note?: string): Promise<void> {
  await prisma.workerHeartbeat.create({ data: { note: note ?? null } });
}

/**
 * Ping an optional healthchecks.io-style URL on a successful run. Wired but OFF
 * unless HEALTHCHECK_PING_URL is set (the owner-flipped dead-man's-switch). Never
 * throws — a monitoring ping must not fail the job.
 */
export async function pingHealthcheck(): Promise<void> {
  const url = process.env.HEALTHCHECK_PING_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, { method: "POST" });
  } catch (err) {
    console.error("[heartbeat] healthcheck ping failed (ignored):", err);
  }
}

/** Read the latest heartbeat and classify the worker's liveness. */
export async function getWorkerStatus(): Promise<WorkerStatusResult> {
  const latest = await prisma.workerHeartbeat.findFirst({
    orderBy: { beatAt: "desc" },
    select: { beatAt: true },
  });
  const lastHeartbeatAt = latest?.beatAt ?? null;
  const now = new Date();
  return {
    status: classifyWorkerStatus(lastHeartbeatAt, now),
    lastHeartbeatAt: lastHeartbeatAt ? lastHeartbeatAt.toISOString() : null,
    ageMs: lastHeartbeatAt ? now.getTime() - lastHeartbeatAt.getTime() : null,
  };
}
