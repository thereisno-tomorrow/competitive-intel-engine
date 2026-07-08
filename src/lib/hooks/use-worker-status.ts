"use client";

import { useQuery } from "@tanstack/react-query";
import type { WorkerStatusResult } from "@/lib/health/status";

export function useWorkerStatus() {
  return useQuery<WorkerStatusResult>({
    queryKey: ["worker-status"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Failed to fetch worker status");
      return res.json();
    },
    // Poll so the light updates without a reload.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
