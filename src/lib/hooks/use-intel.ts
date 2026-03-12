"use client";

import { useQuery } from "@tanstack/react-query";
import type { IntelResponse, IntelFilters } from "@/types";

export function useIntel(filters: IntelFilters = {}) {
  return useQuery<IntelResponse>({
    queryKey: ["intel", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.competitorId) params.set("competitorId", filters.competitorId);
      if (filters.type) params.set("type", filters.type);
      if (filters.tier) params.set("tier", filters.tier);
      if (filters.simulated !== undefined)
        params.set("simulated", String(filters.simulated));
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.limit !== undefined)
        params.set("limit", String(filters.limit));
      if (filters.offset !== undefined)
        params.set("offset", String(filters.offset));

      const query = params.toString();
      const url = `/api/intel${query ? `?${query}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch intel");
      return res.json();
    },
  });
}
