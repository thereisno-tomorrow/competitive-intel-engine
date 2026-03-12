"use client";

import { useQuery } from "@tanstack/react-query";
import type { BattlecardSummary, BattlecardDetail } from "@/types";

export function useBattlecards() {
  return useQuery<BattlecardSummary[]>({
    queryKey: ["battlecards"],
    queryFn: async () => {
      const res = await fetch("/api/battlecards");
      if (!res.ok) throw new Error("Failed to fetch battlecards");
      return res.json();
    },
  });
}

export function useBattlecard(competitorId: string) {
  return useQuery<BattlecardDetail>({
    queryKey: ["battlecards", competitorId],
    queryFn: async () => {
      const res = await fetch(`/api/battlecards/${competitorId}`);
      if (!res.ok) throw new Error("Failed to fetch battlecard");
      return res.json();
    },
    enabled: !!competitorId,
  });
}
