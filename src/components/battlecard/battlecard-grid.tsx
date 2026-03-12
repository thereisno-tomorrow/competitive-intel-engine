"use client";

import Link from "next/link";
import type { BattlecardSummary } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BattlecardCard({ battlecard }: { battlecard: BattlecardSummary }) {
  const href = `/battlecards/${battlecard.competitorName.toLowerCase()}`;

  return (
    <Link href={href} className="group block">
      <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3.5 transition-all group-hover:border-brand-200 group-hover:bg-brand-50/30 group-hover:shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-zinc-900 group-hover:text-brand-700 transition-colors">
            {battlecard.competitorName}
          </h3>
          <span className="text-xs font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
            View &rarr;
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>Updated {formatDate(battlecard.lastUpdated)}</span>
          <span className="h-3 w-px bg-zinc-200" />
          <span className="font-medium tabular-nums text-zinc-500">
            {battlecard.reframeCount}{" "}
            {battlecard.reframeCount === 1 ? "reframe" : "reframes"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BattlecardGrid({
  battlecards,
}: {
  battlecards: BattlecardSummary[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {battlecards.map((bc) => (
        <BattlecardCard key={bc.competitorId} battlecard={bc} />
      ))}
    </div>
  );
}
