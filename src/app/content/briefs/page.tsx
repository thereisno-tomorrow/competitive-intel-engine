"use client";

import Link from "next/link";
import { useContentBriefs, useGenerateBriefs } from "@/lib/hooks/use-content-briefs";
import { Badge } from "@/components/ui/badge";
import {
  bucketLabelsShort as bucketLabels,
  bucketColors,
  funnelLabels,
} from "@/lib/constants/content";

// ─── Brief Card ─────────────────────────────────────────────

function BriefCard({
  brief,
}: {
  brief: {
    id: string;
    title: string;
    angle: string;
    bucket: string;
    funnelStage: string;
    priorityScore: number;
    status: string;
    competitorName: string | null;
    draftsCount: number;
    createdAt: string;
  };
}) {
  return (
    <Link href={`/content/briefs/${brief.id}`}>
      <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm hover:border-brand-300/60 hover:shadow-md transition-all cursor-pointer">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 leading-snug">
              {brief.title}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {brief.priorityScore}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed mb-3 line-clamp-2">
            {brief.angle}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={bucketColors[brief.bucket] ?? "bg-zinc-100 text-zinc-700"}>
              {bucketLabels[brief.bucket] ?? brief.bucket}
            </Badge>
            <Badge variant="outline" className="text-zinc-500">
              {funnelLabels[brief.funnelStage] ?? brief.funnelStage}
            </Badge>
            {brief.competitorName && (
              <Badge variant="secondary">{brief.competitorName}</Badge>
            )}
            {brief.draftsCount > 0 && (
              <span className="text-[10px] text-zinc-400 ml-auto">
                {brief.draftsCount} draft{brief.draftsCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Loading / Empty / Error States ─────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-zinc-100" />
      ))}
    </div>
  );
}

function EmptyState({ onScan, isScanning }: { onScan: () => void; isScanning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-24 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <span className="text-xl text-brand-400">✎</span>
      </div>
      <p className="text-base font-medium text-zinc-500">
        No content briefs yet
      </p>
      <p className="mt-1.5 text-sm text-zinc-400 max-w-md">
        Scan War Room intelligence to generate prioritized content opportunities with segment treatments.
      </p>
      <button
        onClick={onScan}
        disabled={isScanning}
        className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isScanning ? "Scanning…" : "Scan for Content Opportunities"}
      </button>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">
        Failed to load content briefs
      </p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function ContentBriefsPage() {
  const { data: briefs, isLoading, error } = useContentBriefs();
  const generateBriefs = useGenerateBriefs();

  const handleScan = () => {
    generateBriefs.mutate();
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            Content Engine
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            AI-generated content briefs from War Room intelligence
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={generateBriefs.isPending}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generateBriefs.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Scanning…
            </span>
          ) : (
            "Scan for Content Opportunities"
          )}
        </button>
      </div>

      {generateBriefs.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            Failed to generate briefs: {generateBriefs.error.message}
          </p>
        </div>
      )}

      {/* Brief Cards */}
      {!briefs || briefs.length === 0 ? (
        <EmptyState onScan={handleScan} isScanning={generateBriefs.isPending} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {briefs.map((brief) => (
            <BriefCard key={brief.id} brief={brief} />
          ))}
        </div>
      )}
    </div>
  );
}
