"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ContentDraftDetail {
  id: string;
  briefId: string;
  contentType: string;
  segment: string;
  title: string;
  content: string;
  wordCount: number;
  version: number;
  status: string;
  generationMetadata: Record<string, unknown> | null;
  createdAt: string;
  brief: {
    id: string;
    title: string;
    angle: string;
    bucket: string;
    funnelStage: string;
    competitorName: string | null;
  };
}

export interface GenerateDraftInput {
  briefId: string;
  contentType: "BLOG_POST" | "COMPARISON_PAGE";
  segment: "STARTUP" | "MSME" | "MID_MARKET";
}

export function useContentDraft(id: string) {
  return useQuery<ContentDraftDetail>({
    queryKey: ["content", "drafts", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/drafts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch content draft");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useGenerateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateDraftInput) => {
      const res = await fetch("/api/content/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to generate draft");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["content", "briefs", variables.briefId],
      });
    },
  });
}

