"use client";

import { useLatestPulse } from "@/lib/hooks/use-latest-pulse";
import { AlertCard } from "@/components/pulse/alert-card";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import { ClaimStatusIndicator } from "@/components/shared/claim-status-indicator";
import { Badge } from "@/components/ui/badge";
import { SectionCard as DashboardCard } from "@/components/shared/section-card";
import type { DashboardResponse } from "@/types";
import type { ClaimStatus } from "@/generated/prisma/client";

// ─── Text Renderers ───────────────────────────────────────────

function ProseBlock({ text }: { text: string }) {
  return <p className="text-sm text-zinc-700 leading-relaxed">{text}</p>;
}

function SectionEmpty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-zinc-400 italic">{text}</p>;
}

// ─── Loading / Empty / Error ───────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-xl bg-zinc-100" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 h-64 rounded-xl bg-zinc-100" />
        <div className="md:col-span-2 h-64 rounded-xl bg-zinc-100" />
      </div>
      <div className="h-48 rounded-xl bg-zinc-100" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="h-48 rounded-xl bg-zinc-100" />
        <div className="h-48 rounded-xl bg-zinc-100" />
      </div>
      <div className="h-16 rounded-xl bg-zinc-100" />
      <div className="h-32 rounded-xl bg-zinc-100" />
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
        No intelligence published yet
      </p>
      <p className="mt-1.5 text-sm text-zinc-400">
        The first pulse will appear here once the ingestion pipeline has run.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-24 text-center">
      <p className="text-base font-medium text-red-600">
        Failed to load intelligence
      </p>
      <p className="mt-1.5 text-sm text-red-400">{message}</p>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────

const statusOrder: Record<ClaimStatus, number> = {
  CONTESTED: 0,
  UNDER_PRESSURE: 1,
  HOLDING: 2,
};

const changeIndicator: Record<
  "improved" | "unchanged" | "degraded",
  { icon: string; className: string; label: string }
> = {
  improved: { icon: "\u2191", className: "text-emerald-600", label: "Improved" },
  unchanged: { icon: "\u2192", className: "text-zinc-400", label: "Unchanged" },
  degraded: { icon: "\u2193", className: "text-red-600", label: "Degraded" },
};

// ─── Unified Dashboard ────────────────────────────────────────

function UnifiedDashboard({ data }: { data: DashboardResponse }) {
  const weekly = data.latestWeekly;
  const monthly = data.latestMonthly;
  const alerts = data.signalAlertsThisWeek;

  // Pick the most recent pulse for the headline
  const latestPulse = [weekly, monthly]
    .filter(Boolean)
    .sort((a, b) => new Date(b!.publishedAt).getTime() - new Date(a!.publishedAt).getTime())[0]!;

  const isLatestWeekly = latestPulse === weekly;
  const pulseLabel = isLatestWeekly ? "Weekly Pulse" : "Monthly Pulse";

  const formattedDate = new Date(latestPulse.publishedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Monthly sections (with safe defaults)
  const categoryHealth = monthly?.content.sections.categoryHealth ?? null;
  const positioningConfidence = monthly?.content.sections.positioningConfidence ?? [];
  const tier1Shifts = monthly?.content.sections.tier1Shifts ?? [];
  const tier2Watch = monthly?.content.sections.tier2Watch ?? [];
  const contentImplications = monthly?.content.sections.contentImplications ?? [];

  // Weekly sections (with safe defaults)
  const claimStatuses = weekly?.content.sections.claimStatuses ?? [];
  const actionRequired = weekly?.content.sections.actionRequired ?? null;
  const outlook = weekly?.content.sections.outlook ?? null;

  // Sorted claims for positioning section
  const sortedMonthlyConfidence = [...positioningConfidence].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );
  const sortedWeeklyClaims = [...claimStatuses].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );

  return (
    <div className="space-y-6">
      {/* ── Row 1: Headline Banner ── */}
      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Badge className="bg-brand-600 text-white hover:bg-brand-700 text-xs font-semibold">
            {pulseLabel}
          </Badge>
          <span className="text-sm text-zinc-500">{formattedDate}</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 leading-tight tracking-tight">
          {latestPulse.headline}
        </h1>
        {outlook && (
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
            {outlook}
          </p>
        )}
      </div>

      {/* ── Row 2: Signal Alerts + Category Health ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <DashboardCard
            title="Signal Alerts"
            guide="Material competitor moves requiring a response"
          >
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            ) : (
              <SectionEmpty text="Nothing notable this week. A quiet week is a good week." />
            )}
          </DashboardCard>
        </div>

        <div className="md:col-span-2">
          <DashboardCard
            title="Category Health"
            guide="Overall market dynamics and consolidation trends"
          >
            {categoryHealth ? (
              <ProseBlock text={categoryHealth} />
            ) : (
              <SectionEmpty text="No category assessment yet. Available after the first monthly pulse." />
            )}
          </DashboardCard>
        </div>
      </div>

      {/* ── Row 3: Positioning Confidence (full-width) ── */}
      <DashboardCard
        title="Positioning Confidence"
        guide="How your positioning claims stack up against the latest evidence"
      >
        {sortedMonthlyConfidence.length > 0 ? (
          /* Full monthly table with evidence counts + assessments */
          <div className="overflow-x-auto -mx-1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Claim
                  </th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    For
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Against
                  </th>
                  <th className="text-left py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Assessment
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMonthlyConfidence.map((claim) => (
                  <tr
                    key={claim.claimId}
                    className="border-b border-zinc-200 last:border-0"
                  >
                    <td className="py-3 pr-4 text-sm font-medium text-zinc-800 max-w-[280px]">
                      {claim.claimText}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <ClaimStatusIndicator
                          status={claim.status}
                          claimText=""
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm font-semibold text-emerald-600">
                      {claim.evidenceForCount}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm font-semibold text-red-500">
                      {claim.evidenceAgainstCount}
                    </td>
                    <td className="py-3 pl-4 align-top">
                      <p className="text-sm text-zinc-600 leading-relaxed">{claim.assessment}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : sortedWeeklyClaims.length > 0 ? (
          /* Compact weekly card view as fallback */
          <div className="space-y-4">
            {sortedWeeklyClaims.map((claim) => {
              const change = changeIndicator[claim.changeFromLastWeek];
              return (
                <div
                  key={claim.claimId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3.5 py-3"
                >
                  <ClaimStatusIndicator
                    status={claim.status}
                    claimText={claim.claimText}
                  />
                  <span
                    className={`text-xs font-semibold shrink-0 ${change.className}`}
                    title={change.label}
                  >
                    {change.icon} {change.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <SectionEmpty text="No positioning data available yet." />
        )}
      </DashboardCard>

      {/* ── Row 4: Tier 1 Shifts + Tier 2 Watch ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DashboardCard
          title="Tier 1 Narrative Shifts"
          guide="Major positioning changes from primary competitors"
        >
          {tier1Shifts.length > 0 ? (
            <div className="space-y-3">
              {tier1Shifts.map((shift, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-zinc-800">
                      {shift.competitor}
                    </span>
                    <EvidenceTierBadge tier={shift.evidenceTier} />
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {shift.narrative}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <SectionEmpty text="No major narrative shifts detected." />
          )}
        </DashboardCard>

        <DashboardCard
          title="Tier 2 Watch List"
          guide="Emerging signals from secondary players worth monitoring"
        >
          {tier2Watch.length > 0 ? (
            <div className="space-y-3">
              {tier2Watch.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-zinc-800 shrink-0 mt-0.5">
                    {item.competitor}:
                  </span>
                  <span className="text-sm text-zinc-600 leading-relaxed">
                    {item.signal}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <SectionEmpty text="No notable tier 2 signals." />
          )}
        </DashboardCard>
      </div>

      {/* ── Row 5: Action Required (always visible) ── */}
      <div
        className={`rounded-xl border px-5 py-4 shadow-sm ${actionRequired
            ? "border-amber-200 bg-amber-50"
            : "border-zinc-200 bg-zinc-50"
          }`}
      >
        <h2
          className={`text-sm font-bold uppercase tracking-wider mb-1 ${actionRequired ? "text-amber-800" : "text-zinc-500"
            }`}
        >
          Action Required
        </h2>
        <p
          className={`text-sm leading-relaxed ${actionRequired ? "text-amber-700" : "text-zinc-400 italic"
            }`}
        >
          {actionRequired ?? "No immediate actions required. Continue monitoring."}
        </p>
      </div>

      {/* ── Row 6: Content Implications ── */}
      <DashboardCard
        title="Content Implications"
        guide="Recommended content actions based on the latest intelligence"
      >
        {contentImplications.length > 0 ? (
          <ul className="space-y-3">
            {contentImplications.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-zinc-700 leading-relaxed"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <SectionEmpty text="No specific content implications yet. Available after the first monthly pulse." />
        )}
      </DashboardCard>
    </div>
  );
}

// ─── Home Page ─────────────────────────────────────────────────

export default function Home() {
  const { data, isLoading, error } = useLatestPulse();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <EmptyState />;

  return <UnifiedDashboard data={data} />;
}
