"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ContentBriefSummary {
  id: string;
  title: string;
  angle: string;
  bucket: string;
  funnelStage: string;
  buyerProblem: string;
  priorityScore: number;
  status: string;
  competitorName: string | null;
  draftsCount: number;
  createdAt: string;
}

export interface ContentBriefDetail {
  id: string;
  title: string;
  angle: string;
  bucket: string;
  funnelStage: string;
  buyerProblem: string;
  treatments: Array<{
    segment: string;
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  }>;
  priorityScore: number;
  priorityRationale: string | null;
  notes: string | null;
  status: string;
  sourceId: string | null;
  competitorId: string | null;
  competitorName: string | null;
  createdAt: string;
  updatedAt: string;
  drafts: Array<{
    id: string;
    contentType: string;
    segment: string;
    title: string;
    wordCount: number;
    version: number;
    status: string;
    createdAt: string;
  }>;
}

export function useContentBriefs() {
  return useQuery<ContentBriefSummary[]>({
    queryKey: ["content", "briefs"],
    queryFn: async () => {
      const res = await fetch("/api/content/briefs");
      if (!res.ok) throw new Error("Failed to fetch content briefs");
      return res.json();
    },
  });
}

export function useContentBrief(id: string) {
  return useQuery<ContentBriefDetail>({
    queryKey: ["content", "briefs", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/briefs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch content brief");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useGenerateBriefs() {
  const queryClient = useQueryClient();

  return useMutation<ContentBriefSummary[]>({
    mutationFn: async () => {
      const res = await fetch("/api/content/briefs", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate briefs");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", "briefs"] });
    },
  });
}

