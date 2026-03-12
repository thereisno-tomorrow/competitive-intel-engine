"use client";

import { use, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { useContentDraft } from "@/lib/hooks/use-content-drafts";
import { Badge } from "@/components/ui/badge";
import { segmentLabels } from "@/lib/constants/content";

// ─── Loading / Error ────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-zinc-100" />
      <div className="h-[600px] rounded-xl bg-zinc-100" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">Failed to load draft</p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function DraftViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: draft, isLoading, error } = useContentDraft(id);
  const [briefContextOpen, setBriefContextOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!draft) return <ErrorState message="Draft not found" />;

  const handleExport = () => {
    const blob = new Blob([draft.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/content/briefs/${draft.briefId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        ← Back to Brief
      </Link>

      {/* Collapsible Brief Context */}
      <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setBriefContextOpen(!briefContextOpen)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">
              Brief Context
            </h2>
            <Badge variant="outline" className="text-zinc-500">
              {draft.brief.bucket}
            </Badge>
            <Badge variant="outline" className="text-zinc-500">
              {draft.brief.funnelStage}
            </Badge>
            {draft.brief.competitorName && (
              <Badge variant="secondary">{draft.brief.competitorName}</Badge>
            )}
          </div>
          <span className="text-xs text-zinc-400">
            {briefContextOpen ? "−" : "+"}
          </span>
        </button>
        {briefContextOpen && (
          <div className="border-t border-zinc-100 px-5 py-4 space-y-2">
            <p className="text-sm text-zinc-700">
              <span className="font-medium">Title:</span> {draft.brief.title}
            </p>
            <p className="text-sm text-zinc-700">
              <span className="font-medium">Angle:</span> {draft.brief.angle}
            </p>
          </div>
        )}
      </div>

      {/* Header with actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            {draft.title}
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-zinc-500">
              {draft.contentType === "BLOG_POST" ? "Blog Post" : "Comparison Page"}
            </Badge>
            <Badge variant="secondary">
              {segmentLabels[draft.segment] ?? draft.segment}
            </Badge>
            <span className="text-xs text-zinc-400">
              {draft.wordCount.toLocaleString()} words · v{draft.version}
            </span>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
        >
          Export .md
        </button>
      </div>

      {/* Rendered Markdown */}
      <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm px-8 py-6">
        <div className="prose prose-zinc max-w-none prose-headings:tracking-tight prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-p:leading-relaxed prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-800 prose-li:text-zinc-700">
          <Markdown>{draft.content}</Markdown>
        </div>
      </div>
    </div>
  );
}
