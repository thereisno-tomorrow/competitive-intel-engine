"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useContentBrief } from "@/lib/hooks/use-content-briefs";
import { useGenerateDraft } from "@/lib/hooks/use-content-drafts";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/shared/section-card";
import {
  bucketLabels,
  bucketColors,
  funnelLabels,
  segmentLabels,
  segmentColors,
} from "@/lib/constants/content";

// ─── Segment Treatment Card ─────────────────────────────────

function TreatmentCard({
  treatment,
}: {
  treatment: {
    segment: string;
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  };
}) {
  const colors = segmentColors[treatment.segment] ?? segmentColors.STARTUP!;

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${colors.border}`}>
      <div className={`border-b px-5 py-3.5 ${colors.header}`}>
        <Badge className={colors.accent}>
          {segmentLabels[treatment.segment] ?? treatment.segment}
        </Badge>
        <h3 className="mt-2 text-sm font-semibold text-zinc-900 leading-snug">
          {treatment.headline}
        </h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Angle
          </span>
          <p className="text-sm text-zinc-700 leading-relaxed">{treatment.angle}</p>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Key Messages
          </span>
          <ul className="space-y-1.5">
            {treatment.keyMessages.map((msg, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-zinc-700 leading-relaxed"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                {msg}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Buyer Persona
          </span>
          <p className="text-sm text-zinc-600 leading-relaxed italic">{treatment.buyerPersona}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Loading / Error ────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-xl bg-zinc-100" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-64 rounded-xl bg-zinc-100" />
        <div className="h-64 rounded-xl bg-zinc-100" />
        <div className="h-64 rounded-xl bg-zinc-100" />
      </div>
      <div className="h-48 rounded-xl bg-zinc-100" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">Failed to load brief</p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: brief, isLoading, error } = useContentBrief(id);
  const generateDraft = useGenerateDraft();
  const [generatingSegment, setGeneratingSegment] = useState<string | null>(null);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!brief) return <ErrorState message="Brief not found" />;

  const treatments = brief.treatments as Array<{
    segment: string;
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  }>;

  const handleGenerateDraft = (contentType: "BLOG_POST" | "COMPARISON_PAGE", segment: string) => {
    setGeneratingSegment(segment);
    generateDraft.mutate(
      {
        briefId: id,
        contentType,
        segment: segment as "STARTUP" | "MSME" | "MID_MARKET",
      },
      {
        onSettled: () => setGeneratingSegment(null),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/content/briefs"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        ← Back to Briefs
      </Link>

      {/* Header Banner */}
      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-6 py-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge className={bucketColors[brief.bucket] ?? "bg-zinc-100 text-zinc-700"}>
            {bucketLabels[brief.bucket] ?? brief.bucket}
          </Badge>
          <Badge variant="outline" className="text-zinc-500">
            {funnelLabels[brief.funnelStage] ?? brief.funnelStage}
          </Badge>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {brief.priorityScore}
          </span>
          {brief.competitorName && (
            <Badge variant="secondary">{brief.competitorName}</Badge>
          )}
        </div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
          {brief.title}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">{brief.angle}</p>
      </div>

      {/* Buyer Problem */}
      <SectionCard
        title="Buyer Problem"
        guide="The core problem this content addresses"
      >
        <p className="text-sm text-zinc-700 leading-relaxed">{brief.buyerProblem}</p>
      </SectionCard>

      {/* Segment Treatments (3 cards side-by-side) */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 mb-3">
          Segment Treatments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {treatments.map((treatment) => (
            <TreatmentCard key={treatment.segment} treatment={treatment} />
          ))}
        </div>
      </div>

      {/* Generate Draft Buttons */}
      <SectionCard
        title="Generate Drafts"
        guide="Select a segment and content type to generate a full draft"
      >
        <div className="space-y-3">
          {treatments.map((treatment) => (
            <div key={treatment.segment} className="flex items-center gap-3">
              <Badge className={(segmentColors[treatment.segment] ?? segmentColors.STARTUP!).accent}>
                {segmentLabels[treatment.segment] ?? treatment.segment}
              </Badge>
              <button
                onClick={() => handleGenerateDraft("BLOG_POST", treatment.segment)}
                disabled={generateDraft.isPending}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                {generatingSegment === treatment.segment && generateDraft.isPending
                  ? "Generating…"
                  : "Blog Post"}
              </button>
              {brief.competitorId && (
                <button
                  onClick={() => handleGenerateDraft("COMPARISON_PAGE", treatment.segment)}
                  disabled={generateDraft.isPending}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  {generatingSegment === treatment.segment && generateDraft.isPending
                    ? "Generating…"
                    : "Comparison Page"}
                </button>
              )}
            </div>
          ))}
        </div>

        {generateDraft.isError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              Failed to generate draft: {generateDraft.error.message}
            </p>
          </div>
        )}
      </SectionCard>

      {/* Priority Rationale + Notes */}
      {(brief.priorityRationale || brief.notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {brief.priorityRationale && (
            <SectionCard
              title="Priority Rationale"
              guide="Why this brief was scored this way"
            >
              <p className="text-sm text-zinc-700 leading-relaxed">
                {brief.priorityRationale}
              </p>
            </SectionCard>
          )}
          {brief.notes && (
            <SectionCard
              title="Strategic Notes"
              guide="AEO potential, dark social, LinkedIn recommendations"
            >
              <p className="text-sm text-zinc-700 leading-relaxed">{brief.notes}</p>
            </SectionCard>
          )}
        </div>
      )}

      {/* Existing Drafts */}
      {brief.drafts.length > 0 && (
        <SectionCard
          title={`Drafts (${brief.drafts.length})`}
          guide="Generated content drafts for this brief"
        >
          <div className="space-y-2">
            {brief.drafts.map((draft) => (
              <Link key={draft.id} href={`/content/drafts/${draft.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 hover:border-brand-200 hover:bg-white transition-all cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-zinc-500">
                      {draft.contentType === "BLOG_POST" ? "Blog" : "Comparison"}
                    </Badge>
                    <Badge className={(segmentColors[draft.segment] ?? segmentColors.STARTUP!).accent}>
                      {segmentLabels[draft.segment] ?? draft.segment}
                    </Badge>
                    <span className="text-sm text-zinc-700">{draft.title}</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {draft.wordCount.toLocaleString()} words
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
