"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardResponse } from "@/types";

export function useLatestPulse() {
  return useQuery<DashboardResponse | null>({
    queryKey: ["pulse", "latest"],
    queryFn: async () => {
      const res = await fetch("/api/pulse/latest");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch latest pulse");
      return res.json();
    },
  });
}
