"use client";

import { useQuery } from "@tanstack/react-query";
import type { WeeklyPulseContent, MonthlyPulseContent } from "@/types";

export interface PulseItem {
  id: string;
  type: "weekly" | "monthly";
  publishedAt: string;
  headline: string;
  content: WeeklyPulseContent | MonthlyPulseContent;
  wordCount: number;
}

interface PulsesResponse {
  items: PulseItem[];
  total: number;
  limit: number;
  offset: number;
}

export function usePulses(
  type?: "weekly" | "monthly",
  limit = 20,
  offset = 0,
) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return useQuery<PulsesResponse>({
    queryKey: ["pulses", type, limit, offset],
    queryFn: async () => {
      const res = await fetch(`/api/pulses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch pulses");
      return res.json();
    },
  });
}
