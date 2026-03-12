"use client";

import { useState } from "react";
import type {
  BattlecardDetail as BattlecardDetailType,
  WhyWeWinPoint,
  WhyWeLosePoint,
  TrapQuestion,
  ProofPoint,
} from "@/types";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Quick Dismiss (hero — first thing reps see) ──────────────

function QuickDismissSection({
  quickDismiss,
}: {
  quickDismiss: BattlecardDetailType["quickDismiss"];
}) {
  return (
    <SectionCard
      title="Quick Dismiss"
      guide="Use these in early-stage conversations to neutralize this competitor fast"
      accent="green"
    >
      {quickDismiss ? (
        <>
          <ol className="space-y-2.5 mb-4">
            {quickDismiss.keyDismissals.map((line, i) => (
              <li
                key={i}
                className="text-sm text-zinc-800 leading-relaxed flex items-start gap-3"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 mt-0.5">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1.5 block">
              Talk Track
            </span>
            <p className="text-sm text-zinc-800 leading-relaxed">
              {quickDismiss.talkTrack}
            </p>
          </div>
        </>
      ) : (
        <p className="py-4 text-sm text-zinc-400 italic">
          Quick dismiss talking points not yet available.
        </p>
      )}
    </SectionCard>
  );
}

// ─── Trap Question Card ───────────────────────────────────────

function TrapQuestionCard({ trap, index }: { trap: TrapQuestion; index: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm font-medium text-zinc-900 leading-relaxed">
          &ldquo;{trap.question}&rdquo;
        </p>
      </div>
      <div className="ml-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">
          Why this works
        </span>
        <p className="text-sm text-zinc-600 leading-relaxed">
          {trap.whyItWorks}
        </p>
      </div>
      <div className="ml-8 rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1 block">
          Follow up
        </span>
        <p className="text-sm text-zinc-800 leading-relaxed">
          {trap.followUp}
        </p>
      </div>
    </div>
  );
}

// ─── Competitive Advantage Card (Win/Lose) ────────────────────

function CompActCard({
  item,
  variant,
}: {
  item: WhyWeWinPoint | WhyWeLosePoint;
  variant: "win" | "lose";
}) {
  const actionLabel = variant === "win" ? "What to do" : "How to counter";
  const actionColor = variant === "win" ? "text-emerald-700" : "text-amber-700";
  const actionBg =
    variant === "win"
      ? "bg-emerald-50/60 border-emerald-200/60"
      : "bg-amber-50/50 border-amber-200/60";

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium text-zinc-900">{item.point}</p>
        <EvidenceTierBadge tier={item.evidenceTier} />
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed">{item.context}</p>
      <div className={`rounded-lg border p-3 ${actionBg}`}>
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${actionColor} mb-1 block`}
        >
          {actionLabel}
        </span>
        <p className="text-sm text-zinc-800 leading-relaxed">{item.action}</p>
      </div>
    </div>
  );
}

// ─── Proof Point Card ─────────────────────────────────────────

const proofTypeLabels: Record<ProofPoint["type"], string> = {
  case_study: "Case Study",
  switch_story: "Switch Story",
  quote: "Quote",
};

function ProofPointCard({ proof }: { proof: ProofPoint }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 space-y-2">
      <Badge variant="secondary" className="w-fit">
        {proofTypeLabels[proof.type]}
      </Badge>
      <p className="text-sm text-zinc-700 leading-relaxed">{proof.text}</p>
      {(proof.source || proof.url) && (
        <div className="flex items-center gap-2">
          {proof.source && (
            <span className="text-xs text-zinc-400">{proof.source}</span>
          )}
          {proof.url && (
            <a
              href={proof.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2"
            >
              View
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Reframe ──────────────────────────────────────

function CollapsibleReframe({
  reframe,
  index,
}: {
  reframe: BattlecardDetailType["reframes"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
          {index + 1}
        </span>
        <span className="text-sm text-zinc-600 leading-snug flex-1 min-w-0">
          {reframe.weakness}
        </span>
        <EvidenceTierBadge tier={reframe.evidenceTier} />
        <span className="text-xs text-zinc-400 w-4 text-center shrink-0">
          {open ? "\u2212" : "+"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-zinc-100">
          <div className="rounded-lg bg-white border border-emerald-200/60 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1 block">
              Say this
            </span>
            <p className="text-sm font-medium text-zinc-900 leading-relaxed">
              {reframe.reframe}
            </p>
          </div>

          {reframe.antiReframe && (
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1 block">
                Don&apos;t say
              </span>
              <p className="text-sm text-amber-800 leading-relaxed">
                {reframe.antiReframe}
              </p>
            </div>
          )}

          {reframe.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {reframe.sources.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2"
                >
                  Source
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────

export function BattlecardDetailView({
  battlecard,
}: {
  battlecard: BattlecardDetailType;
}) {
  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            {battlecard.competitor.name}
          </h1>
          <Badge
            variant={
              battlecard.competitor.tier === "TIER_1" ? "default" : "secondary"
            }
          >
            {battlecard.competitor.tier === "TIER_1" ? "Tier 1" : "Tier 2"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500">
          Last updated {formatDate(battlecard.lastUpdated)}
        </p>
      </div>

      {/* ── Quick Dismiss (hero) ── */}
      <QuickDismissSection quickDismiss={battlecard.quickDismiss} />

      {/* ── Row: When They Come Up + Their Pitch ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard
          title="When They Come Up"
          guide="Typical deal context where this competitor is mentioned"
        >
          <p className="text-sm text-zinc-700 leading-relaxed">
            {battlecard.whenTheyComeUp}
          </p>
        </SectionCard>

        <SectionCard
          title="Their Pitch"
          guide="How they position themselves to prospects"
        >
          {battlecard.theirPitch.length > 0 ? (
            <ul className="space-y-2">
              {battlecard.theirPitch.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-zinc-700 leading-relaxed"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400 italic">
              No pitch points documented yet.
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── Weaknesses (full-width) ── */}
      <SectionCard
        title="Weaknesses"
        guide="Known gaps and vulnerabilities to exploit"
      >
        {battlecard.weaknesses.length > 0 ? (
          <div className="space-y-2">
            {battlecard.weaknesses.map((weakness, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-sm text-zinc-700 leading-relaxed">
                    {weakness.text}
                  </span>
                  <EvidenceTierBadge tier={weakness.evidenceTier} />
                  {weakness.sourceUrl && (
                    <a
                      href={weakness.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2"
                    >
                      Source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-sm text-zinc-400 italic">
            No documented weaknesses yet.
          </p>
        )}
      </SectionCard>

      {/* ── Reframes (collapsible) ── */}
      <SectionCard
        title={battlecard.reframes.length > 0 ? `Reframes (${battlecard.reframes.length})` : "Reframes"}
        guide="Counter their talking points — click to expand each reframe"
      >
        {battlecard.reframes.length > 0 ? (
          <div className="space-y-2">
            {battlecard.reframes.map((reframe, i) => (
              <CollapsibleReframe key={reframe.id} reframe={reframe} index={i} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-sm text-zinc-400 italic">
            No reframes generated yet.
          </p>
        )}
      </SectionCard>

      {/* ── Row: Why We Win + Why We Lose ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard
          title="Why We Win"
          guide="Our competitive advantages against this player"
          accent="green"
        >
          {battlecard.whyWeWin.length > 0 ? (
            <div className="space-y-3">
              {battlecard.whyWeWin.map((item, i) => (
                <CompActCard key={i} item={item} variant="win" />
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No win points documented yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Why We Lose"
          guide="Where they have an edge — and how to counter"
          accent="amber"
        >
          {battlecard.whyWeLose.length > 0 ? (
            <div className="space-y-3">
              {battlecard.whyWeLose.map((item, i) => (
                <CompActCard key={i} item={item} variant="lose" />
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No loss points documented yet.
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── Row: Trap Questions + Proof Points ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard
          title="Trap Setting Questions"
          guide="Questions that expose this competitor's weaknesses"
        >
          {battlecard.trapQuestions.length > 0 ? (
            <div className="space-y-3">
              {battlecard.trapQuestions.map((trap, i) => (
                <TrapQuestionCard key={i} trap={trap} index={i} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No trap questions documented yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Proof Points"
          guide="Evidence to back up your claims in the conversation"
        >
          {battlecard.proofPoints.length > 0 ? (
            <div className="space-y-3">
              {battlecard.proofPoints.map((proof, i) => (
                <ProofPointCard key={i} proof={proof} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No proof points collected yet.
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── Row: Competitor Overview + Open Questions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard
          title="Competitor Overview"
          guide="Background and market positioning"
        >
          {battlecard.overview ? (
            <p className="text-sm text-zinc-700 leading-relaxed">
              {battlecard.overview}
            </p>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No overview available yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Open Questions"
          guide="Internal unknowns to investigate"
        >
          {battlecard.openQuestions.length > 0 ? (
            <ul className="space-y-2">
              {battlecard.openQuestions.map((question, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-zinc-700 leading-relaxed"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                  {question}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-zinc-400 italic">
              No open questions at this time.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
