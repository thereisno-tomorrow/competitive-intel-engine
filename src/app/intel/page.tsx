"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useIntel } from "@/lib/hooks/use-intel";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import { SimulatedBadge } from "@/components/shared/simulated-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntelFilters, IntelItem } from "@/types";
import type {
  IntelType,
  EvidenceTier,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

const INTEL_TYPE_OPTIONS: { value: IntelType; label: string }[] = [
  { value: "PRODUCT_CHANGE", label: "Product Change" },
  { value: "PRICING_CHANGE", label: "Pricing Change" },
  { value: "MESSAGING_SHIFT", label: "Messaging Shift" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "HIRING_SIGNAL", label: "Hiring Signal" },
  { value: "REGULATORY", label: "Regulatory" },
  { value: "OUTAGE", label: "Outage" },
  { value: "PRESS", label: "Press" },
  { value: "REVIEW", label: "Review" },
  { value: "SEO_CHANGE", label: "SEO Change" },
];

const EVIDENCE_TIER_OPTIONS: { value: EvidenceTier; label: string }[] = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "INFERRED", label: "Inferred" },
  { value: "UNKNOWN", label: "Unknown" },
];

const SIMULATED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "real", label: "Real Only" },
  { value: "simulated", label: "Simulated Only" },
] as const;

// ---------------------------------------------------------------------------
// Competitor list hook (lightweight — just id + name for the filter dropdown)
// ---------------------------------------------------------------------------

interface CompetitorOption {
  id: string;
  name: string;
}

function useCompetitors() {
  return useQuery<CompetitorOption[]>({
    queryKey: ["competitors-list"],
    queryFn: async () => {
      const res = await fetch("/api/battlecards");
      if (!res.ok) throw new Error("Failed to fetch competitors");
      const data: Array<{ competitorId: string; competitorName: string }> =
        await res.json();
      return data.map((c) => ({ id: c.competitorId, name: c.competitorName }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — competitor list rarely changes
  });
}

// ---------------------------------------------------------------------------
// Helper: human-readable intel type label
// ---------------------------------------------------------------------------

function intelTypeLabel(type: IntelType): string {
  const match = INTEL_TYPE_OPTIONS.find((o) => o.value === type);
  return match?.label ?? type;
}

// ---------------------------------------------------------------------------
// Helper: format date for the feed
// ---------------------------------------------------------------------------

function formatDetectedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Helper: relative time (e.g. "2 hours ago")
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-24 rounded-lg border border-zinc-100 bg-zinc-100" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-zinc-400">
        No intelligence items found
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        Try adjusting the filters above, or check back after the next ingestion
        run.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-red-500">
        Failed to load intel feed
      </p>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intel feed item row
// ---------------------------------------------------------------------------

function IntelRow({ item }: { item: IntelItem }) {
  return (
    <div className="group flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300">
      {/* Top row: badges + date */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="font-semibold">
          {item.competitor.name}
        </Badge>
        <Badge variant="outline">{intelTypeLabel(item.type)}</Badge>
        {/* Cast required: API returns string but component expects EvidenceTier enum */}
        <EvidenceTierBadge tier={item.evidenceTier as EvidenceTier} />
        {item.simulated && <SimulatedBadge />}
        <span className="ml-auto text-zinc-400">{formatDetectedAt(item.detectedAt)}</span>
      </div>

      {/* Summary */}
      <p className="text-sm leading-snug text-zinc-900">{item.summary}</p>

      {/* Company implication */}
      {item.companyImplication && (
        <p className="text-xs leading-snug text-zinc-500">
          <span className="font-medium text-zinc-600">Company implication:</span>{" "}
          {item.companyImplication}
        </p>
      )}

      {/* Source link */}
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors w-fit"
        >
          <ExternalLink className="size-3" />
          Source
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: IntelFilters;
  onFilterChange: (patch: Partial<IntelFilters>) => void;
  competitors: CompetitorOption[];
}

const PLACEHOLDER_ALL = "__all__";

function FilterBar({ filters, onFilterChange, competitors }: FilterBarProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
      {/* Competitor filter */}
      <Select
        value={filters.competitorId ?? PLACEHOLDER_ALL}
        onValueChange={(v) =>
          onFilterChange({
            competitorId: v === PLACEHOLDER_ALL ? undefined : v,
            offset: 0,
          })
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-[160px]">
          <SelectValue placeholder="Competitor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PLACEHOLDER_ALL}>All Competitors</SelectItem>
          {competitors.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Intel type filter */}
      <Select
        value={filters.type ?? PLACEHOLDER_ALL}
        onValueChange={(v) =>
          onFilterChange({
            type: v === PLACEHOLDER_ALL ? undefined : (v as IntelType),
            offset: 0,
          })
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PLACEHOLDER_ALL}>All Types</SelectItem>
          {INTEL_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Evidence tier filter */}
      <Select
        value={filters.tier ?? PLACEHOLDER_ALL}
        onValueChange={(v) =>
          onFilterChange({
            tier: v === PLACEHOLDER_ALL ? undefined : (v as EvidenceTier),
            offset: 0,
          })
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-[150px]">
          <SelectValue placeholder="Evidence Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PLACEHOLDER_ALL}>All Tiers</SelectItem>
          {EVIDENCE_TIER_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Simulated toggle */}
      <Select
        value={
          filters.simulated === undefined
            ? "all"
            : filters.simulated
              ? "simulated"
              : "real"
        }
        onValueChange={(v) =>
          onFilterChange({
            simulated:
              v === "all" ? undefined : v === "simulated" ? true : false,
            offset: 0,
          })
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-[150px]">
          <SelectValue placeholder="Data Source" />
        </SelectTrigger>
        <SelectContent>
          {SIMULATED_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPage: (offset: number) => void;
}

function Pagination({ total, limit, offset, onPage }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-zinc-400">
        Showing {offset + 1}&ndash;{Math.min(offset + limit, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <span className="text-xs text-zinc-500">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPage(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function IntelFeedPage() {
  const [filters, setFilters] = useState<IntelFilters>({
    limit: PAGE_SIZE,
    offset: 0,
  });

  const handleFilterChange = useCallback((patch: Partial<IntelFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const { data: competitors = [] } = useCompetitors();
  const { data, isLoading, error } = useIntel(filters);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page header */}
      <header>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Intel Feed
          </h1>
          {data?.lastUpdated && (
            <span className="text-xs text-zinc-400">
              Last updated {formatRelativeTime(data.lastUpdated)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Raw intelligence stream. Every signal, chronologically.
        </p>
      </header>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        competitors={competitors}
      />

      {/* Feed */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((item) => (
              <IntelRow key={item.id} item={item} />
            ))}
          </div>
          <Pagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            onPage={(newOffset) => handleFilterChange({ offset: newOffset })}
          />
        </>
      )}
    </div>
  );
}
