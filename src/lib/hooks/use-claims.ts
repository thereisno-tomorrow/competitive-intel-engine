"use client";

import { useQuery } from "@tanstack/react-query";
import type { ClaimSummary } from "@/types";

export function useClaims() {
  return useQuery<ClaimSummary[]>({
    queryKey: ["claims"],
    queryFn: async () => {
      const res = await fetch("/api/claims");
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
  });
}
