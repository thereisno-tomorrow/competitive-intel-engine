"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface JudgeVerdictShape {
  pass: boolean;
  violations: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
}

export interface FlaggedItem {
  id: string;
  type: string;
  headline: string;
  publishedAt: string;
  content: unknown;
  rubricVersion: string | null;
  judgeVerdict: JudgeVerdictShape | null;
}

export function useFlagged() {
  return useQuery<{ items: FlaggedItem[]; total: number }>({
    queryKey: ["flagged"],
    queryFn: async () => {
      const res = await fetch("/api/review");
      if (!res.ok) throw new Error("Failed to fetch flagged items");
      return res.json();
    },
  });
}

export function useResolveFlagged() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to resolve flagged item");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["flagged"] });
    },
  });
}
