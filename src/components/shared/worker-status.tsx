"use client";

import { useWorkerStatus } from "@/lib/hooks/use-worker-status";
import type { WorkerStatus } from "@/lib/health/status";
import { cn } from "@/lib/utils";

const CONFIG: Record<
  WorkerStatus | "UNKNOWN",
  { label: string; dot: string; text: string; title: string }
> = {
  LIVE: {
    label: "Live",
    dot: "bg-emerald-500",
    text: "text-emerald-300",
    title: "Worker is running and healthy",
  },
  STALE: {
    label: "Stale",
    dot: "bg-amber-500",
    text: "text-amber-300",
    title: "Worker has not reported recently — it may be lagging",
  },
  DEAD: {
    label: "Dead",
    dot: "bg-red-500",
    text: "text-red-300",
    title: "Worker is not reporting — autonomy is likely OFF",
  },
  UNKNOWN: {
    label: "…",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    title: "Checking worker status",
  },
};

/**
 * Dashboard liveness light. Always renders (calm-sections rule): a dead worker
 * looks visibly different from a quiet news week.
 */
export function WorkerStatus() {
  const { data, isLoading } = useWorkerStatus();
  const key: WorkerStatus | "UNKNOWN" = isLoading || !data ? "UNKNOWN" : data.status;
  const c = CONFIG[key];

  return (
    <div
      className="flex items-center gap-1.5"
      title={c.title}
      aria-label={`Worker status: ${c.label}`}
    >
      <span className={cn("h-2 w-2 rounded-full", c.dot)} />
      <span className={cn("text-[11px] font-medium uppercase tracking-wider", c.text)}>
        {c.label}
      </span>
    </div>
  );
}
