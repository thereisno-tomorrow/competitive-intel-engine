"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBattlecards, useBattlecard } from "@/lib/hooks/use-battlecards";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { BattlecardSummary } from "@/types";
import type { EvidenceTier } from "@/generated/prisma/client";

// === Types ===

interface ReframeFormState {
  weakness: string;
  reframe: string;
  antiReframe: string;
}

interface SaveFeedback {
  type: "success" | "error";
  message: string;
}

// === Reframe Editor Card ===

function ReframeEditor({
  reframe,
  competitorId,
}: {
  reframe: {
    id: string;
    weakness: string;
    reframe: string;
    antiReframe: string;
    evidenceTier: EvidenceTier;
    sources: string[];
  };
  competitorId: string;
}) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ReframeFormState>({
    weakness: reframe.weakness,
    reframe: reframe.reframe,
    antiReframe: reframe.antiReframe,
  });

  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);

  const isDirty =
    form.weakness !== reframe.weakness ||
    form.reframe !== reframe.reframe ||
    form.antiReframe !== reframe.antiReframe;

  const mutation = useMutation({
    mutationFn: async (data: ReframeFormState) => {
      const res = await fetch(
        `/api/battlecards/${competitorId}/reframes/${reframe.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weakness: data.weakness,
            reframe: data.reframe,
            antiReframe: data.antiReframe,
            evidenceTier: "CONFIRMED" as const,
          }),
        }
      );
      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(errorBody || "Failed to save reframe");
      }
      return res.json() as Promise<unknown>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["battlecards"] });
      setFeedback({ type: "success", message: "Saved" });
      setTimeout(() => setFeedback(null), 2500);
    },
    onError: (err: Error) => {
      setFeedback({ type: "error", message: err.message });
    },
  });

  const handleFieldChange = useCallback(
    (field: keyof ReframeFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setFeedback(null);
    },
    []
  );

  const handleSave = useCallback(() => {
    mutation.mutate(form);
  }, [mutation, form]);

  return (
    <Card className="gap-4">
      <CardContent className="space-y-4">
        {/* Weakness */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Weakness
          </label>
          <textarea
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 resize-y min-h-[60px]"
            rows={2}
            value={form.weakness}
            onChange={(e) => handleFieldChange("weakness", e.target.value)}
            placeholder="Competitor weakness..."
          />
        </div>

        {/* Reframe / Talk Track */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Reframe / Talk Track
          </label>
          <textarea
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 resize-y min-h-[80px]"
            rows={3}
            value={form.reframe}
            onChange={(e) => handleFieldChange("reframe", e.target.value)}
            placeholder="How to reframe this in conversation..."
          />
        </div>

        {/* Anti-Reframe / Don't Say */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Anti-Reframe / Don&apos;t Say
          </label>
          <textarea
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 resize-y min-h-[60px]"
            rows={2}
            value={form.antiReframe}
            onChange={(e) => handleFieldChange("antiReframe", e.target.value)}
            placeholder="What NOT to say..."
          />
        </div>

        {/* Evidence Tier + Save */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Evidence:</span>
            <EvidenceTierBadge tier={reframe.evidenceTier} />
          </div>

          <div className="flex items-center gap-3">
            {feedback?.type === "success" && (
              <span className="text-sm font-medium text-green-600">
                {feedback.message}
              </span>
            )}
            {feedback?.type === "error" && (
              <span className="text-sm font-medium text-red-500 max-w-[300px] truncate">
                {feedback.message}
              </span>
            )}
            <Button
              size="sm"
              disabled={!isDirty || mutation.isPending}
              onClick={handleSave}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// === Competitor Section ===

function CompetitorSection({ summary }: { summary: BattlecardSummary }) {
  const { data, isLoading, error } = useBattlecard(summary.competitorId);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          {summary.competitorName}
        </h2>
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: summary.reframeCount || 2 }, (_, i) => (
            <div key={i} className="h-48 rounded-xl bg-zinc-100" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          {summary.competitorName}
        </h2>
        <p className="text-sm text-red-500">
          Failed to load: {error.message}
        </p>
      </section>
    );
  }

  if (!data || data.reframes.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          {summary.competitorName}
        </h2>
        <p className="text-sm text-zinc-400 italic">
          No reframes for this competitor.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          {data.competitor.name}
        </h2>
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {data.competitor.tier.replace("_", " ")}
        </span>
      </div>
      <div className="space-y-3">
        {data.reframes.map((reframe) => (
          <ReframeEditor
            key={reframe.id}
            reframe={reframe}
            competitorId={data.competitor.id}
          />
        ))}
      </div>
    </section>
  );
}

// === Loading Skeleton ===

function LoadingSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-4">
          <div className="h-6 w-48 bg-zinc-200 rounded" />
          <div className="h-48 bg-zinc-100 rounded-xl" />
          <div className="h-48 bg-zinc-100 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// === Error State ===

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-red-500">
        Failed to load battlecards
      </p>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
    </div>
  );
}

// === Empty State ===

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-zinc-400">
        No battlecards to edit
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        Battlecards will appear here once competitor data has been processed.
      </p>
    </div>
  );
}

// === Admin Page ===

export default function AdminPage() {
  const { data: battlecards, isLoading, error } = useBattlecards();

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Admin: Edit Battlecard Reframes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Edit weakness reframes, talk tracks, and anti-reframes. Evidence tier
          is fixed to Confirmed.
        </p>
      </header>

      <Separator />

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !battlecards || battlecards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {battlecards.map((summary) => (
            <CompetitorSection key={summary.competitorId} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}
