"use client";

import { use } from "react";
import { useBattlecard } from "@/lib/hooks/use-battlecards";
import { BattlecardDetailView } from "@/components/battlecard/battlecard-detail";
import Link from "next/link";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-xl bg-zinc-100" />
      <div className="h-64 rounded-xl bg-zinc-100" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="h-48 rounded-xl bg-zinc-100" />
        <div className="h-48 rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">
        Failed to load battlecard
      </p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
      <Link
        href="/battlecards"
        className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2"
      >
        Back to Battlecards
      </Link>
    </div>
  );
}

function BattlecardLoader({ competitorSlug }: { competitorSlug: string }) {
  // API route accepts both CUID and name (case-insensitive)
  const { data: detail, isLoading, error } = useBattlecard(competitorSlug);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!detail) {
    return <LoadingSkeleton />;
  }

  return (
    <div>
      <Link
        href="/battlecards"
        className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium text-zinc-400 hover:text-brand-600 transition-colors"
      >
        &larr; All Battlecards
      </Link>
      <BattlecardDetailView battlecard={detail} />
    </div>
  );
}

export default function BattlecardPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = use(params);

  return <BattlecardLoader competitorSlug={competitor} />;
}
