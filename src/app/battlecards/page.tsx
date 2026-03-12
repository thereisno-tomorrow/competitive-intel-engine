"use client";

import { useBattlecards } from "@/lib/hooks/use-battlecards";
import { BattlecardGrid } from "@/components/battlecard/battlecard-grid";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-zinc-100" />
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="h-4 w-32 rounded bg-zinc-200 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg bg-zinc-100" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="h-4 w-32 rounded bg-zinc-200 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-24 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <span className="text-xl text-brand-400">?</span>
      </div>
      <p className="text-base font-medium text-zinc-500">
        No battlecards available yet
      </p>
      <p className="mt-1.5 text-sm text-zinc-400">
        Battlecards will appear here once competitor data has been processed.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">
        Failed to load battlecards
      </p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
    </div>
  );
}

export default function BattlecardsPage() {
  const { data, isLoading, error } = useBattlecards();

  const tier1 = data?.filter((bc) => bc.tier === "TIER_1") ?? [];
  const tier2 = data?.filter((bc) => bc.tier === "TIER_2") ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-6 py-5 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
          Battlecards
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Competitive positioning guides for sales conversations — know what to say when a competitor comes up.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Tier 1 — Primary Threats */}
          {tier1.length > 0 && (
            <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">
                  Tier 1 — Primary Competitors
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Direct threats that come up in active deals
                </p>
              </div>
              <div className="px-5 py-4">
                <BattlecardGrid battlecards={tier1} />
              </div>
            </div>
          )}

          {/* Tier 2 — Watch List */}
          {tier2.length > 0 && (
            <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">
                  Tier 2 — Watch List
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Emerging or adjacent players worth tracking
                </p>
              </div>
              <div className="px-5 py-4">
                <BattlecardGrid battlecards={tier2} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
