"use client";

import { useState } from "react";
import { usePulses, type PulseItem } from "@/lib/hooks/use-pulses";
import { PulseDetail } from "@/components/pulse/pulse-detail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WeeklyPulseContent, MonthlyPulseContent } from "@/types";

const PAGE_SIZE = 20;

type PulseTypeFilter = "all" | "weekly" | "monthly";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PulseEntry({ pulse }: { pulse: PulseItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="w-full text-left rounded-lg border border-zinc-200 bg-white transition-colors hover:border-zinc-300"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            variant={pulse.type === "weekly" ? "outline" : "secondary"}
            className="shrink-0 text-xs"
          >
            {pulse.type === "weekly" ? "Weekly" : "Monthly"}
          </Badge>
          <span className="text-sm font-medium text-zinc-900 truncate">
            {pulse.headline}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-zinc-400 font-mono tabular-nums">
            {formatDate(pulse.publishedAt)}
          </span>
          <span
            className="text-zinc-400 text-xs transition-transform"
            style={{
              display: "inline-block",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            &#9660;
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 px-5 py-6">
          <PulseDetail
            type={pulse.type}
            content={pulse.content as WeeklyPulseContent | MonthlyPulseContent}
            headline={pulse.headline}
            publishedAt={pulse.publishedAt}
          />
        </div>
      )}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="h-16 rounded-lg border border-zinc-100 bg-zinc-100"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-zinc-400">
        No pulses published yet
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        Pulses will appear here once the generation pipeline has run.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-red-500">
        Failed to load pulses
      </p>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function PulseList({ type }: { type?: "weekly" | "monthly" }) {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = usePulses(type, PAGE_SIZE, offset);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!data || data.items.length === 0) {
    if (offset > 0) {
      // User paginated past last results; let them go back
      return (
        <div className="space-y-4">
          <EmptyState />
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            >
              Previous
            </Button>
          </div>
        </div>
      );
    }
    return <EmptyState />;
  }

  const hasMore = offset + data.items.length < data.total;
  const hasPrevious = offset > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.items.map((pulse) => (
          <PulseEntry key={pulse.id} pulse={pulse} />
        ))}
      </div>

      {/* Pagination */}
      {(hasPrevious || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevious}
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
          >
            Previous
          </Button>
          <span className="text-xs text-zinc-400 tabular-nums">
            {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, data.total)} of{" "}
            {data.total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PulsesPage() {
  const [activeTab, setActiveTab] = useState<PulseTypeFilter>("all");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Pulse Archive
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          All published weekly and monthly intelligence pulses.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PulseTypeFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PulseList />
        </TabsContent>
        <TabsContent value="weekly">
          <PulseList type="weekly" />
        </TabsContent>
        <TabsContent value="monthly">
          <PulseList type="monthly" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
