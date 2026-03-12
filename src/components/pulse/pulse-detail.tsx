"use client";

import type {
  WeeklyPulseContent,
  MonthlyPulseContent,
} from "@/types";
import type { ClaimStatus } from "@/generated/prisma/client";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import { ClaimStatusIndicator } from "@/components/shared/claim-status-indicator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PulseDetailProps {
  type: "weekly" | "monthly";
  content: WeeklyPulseContent | MonthlyPulseContent;
  headline: string;
  publishedAt: string;
}

const changeIndicator: Record<
  "improved" | "unchanged" | "degraded",
  { icon: string; className: string; label: string }
> = {
  improved: { icon: "\u2191", className: "text-green-600", label: "Improved" },
  unchanged: { icon: "\u2192", className: "text-zinc-400", label: "Unchanged" },
  degraded: { icon: "\u2193", className: "text-red-600", label: "Degraded" },
};

const statusOrder: Record<ClaimStatus, number> = {
  CONTESTED: 0,
  UNDER_PRESSURE: 1,
  HOLDING: 2,
};

const threatStatusBadge: Record<
  "DORMANT" | "EMERGING" | "ACTIVE" | "CRITICAL",
  { className: string; label: string }
> = {
  CRITICAL: { className: "bg-red-100 text-red-800 border-red-300", label: "Critical" },
  ACTIVE: { className: "bg-orange-100 text-orange-800 border-orange-300", label: "Active" },
  EMERGING: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Emerging" },
  DORMANT: { className: "bg-zinc-100 text-zinc-600 border-zinc-300", label: "Dormant" },
};

const velocityIndicator: Record<
  "ACCELERATING" | "STABLE" | "DECELERATING" | "UNKNOWN",
  { icon: string; className: string }
> = {
  ACCELERATING: { icon: "↗", className: "text-red-600" },
  STABLE: { icon: "→", className: "text-zinc-400" },
  DECELERATING: { icon: "↘", className: "text-green-600" },
  UNKNOWN: { icon: "?", className: "text-zinc-300" },
};

function WeeklyPulseDetail({ content }: { content: WeeklyPulseContent }) {
  const { topSignals, claimStatuses, actionRequired, outlook, offensiveOpportunities } =
    content.sections;

  const sortedClaims = [...claimStatuses].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );

  return (
    <div className="space-y-8">
      {/* Top Signals */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Top Signals
        </h3>
        <div className="grid gap-3">
          {topSignals.map((signal, i) => (
            <Card key={i} className="py-4">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-zinc-900">
                    {signal.competitor}
                  </CardTitle>
                  <EvidenceTierBadge tier={signal.evidenceTier} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {signal.summary}
                </p>
                <p className="text-sm text-zinc-500 italic">
                  Implication: {signal.implication}
                </p>
                {signal.temporalContext && (
                  <div className="rounded bg-indigo-50 border border-indigo-200 px-2 py-1">
                    <p className="text-xs text-indigo-700">
                      <span className="font-semibold">Temporal Context:</span> {signal.temporalContext}
                    </p>
                  </div>
                )}
                {signal.sourceUrl && (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                  >
                    Source
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Claim Statuses */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Positioning Claims
        </h3>
        <div className="space-y-3">
          {sortedClaims.map((claim) => {
            const change = changeIndicator[claim.changeFromLastWeek];
            return (
              <div
                key={claim.claimId}
                className="flex items-center justify-between"
              >
                <ClaimStatusIndicator
                  status={claim.status}
                  claimText={claim.claimText}
                />
                <span
                  className={`text-xs font-medium ${change.className}`}
                  title={change.label}
                >
                  {change.icon} {change.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Action Required */}
      <Separator />
      <section>
        <div
          className={`rounded-lg border p-4 ${
            actionRequired
              ? "border-amber-200 bg-amber-50"
              : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <h3
            className={`text-sm font-semibold mb-1 ${
              actionRequired ? "text-amber-800" : "text-zinc-500"
            }`}
          >
            Action Required
          </h3>
          <p
            className={`text-sm leading-relaxed ${
              actionRequired ? "text-amber-700" : "text-zinc-400 italic"
            }`}
          >
            {actionRequired ?? "No immediate actions required this week."}
          </p>
        </div>
      </section>

      <Separator />

      {/* Outlook */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Outlook
        </h3>
        <p className="text-sm text-zinc-700 leading-relaxed">{outlook}</p>
      </section>

      {/* Offensive Opportunities (Intelligence Layer) */}
      {offensiveOpportunities && offensiveOpportunities.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 mb-4">
              ⚡ Offensive Opportunities
            </h3>
            <div className="grid gap-3">
              {offensiveOpportunities.map((opp, i) => (
                <Card key={i} className="py-4 border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-emerald-900">
                      {opp.competitor}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-emerald-700">Their Move:</span>
                      <p className="text-sm text-zinc-700 mt-0.5">{opp.theirMove}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-emerald-700">Exposed Weakness:</span>
                      <p className="text-sm text-zinc-700 mt-0.5">{opp.exposedWeakness}</p>
                    </div>
                    <div className="rounded bg-white border border-emerald-300 px-3 py-2">
                      <span className="text-xs font-semibold text-emerald-800">Company Opportunity:</span>
                      <p className="text-sm text-emerald-900 mt-0.5 font-medium">{opp.companyOpportunity}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MonthlyPulseDetail({ content }: { content: MonthlyPulseContent }) {
  const {
    categoryHealth,
    tier1Shifts,
    tier2Watch,
    positioningConfidence,
    contentImplications,
    crossCompetitorPatterns,
    knownUnknowns,
    threatStatusSummary,
  } = content.sections;

  return (
    <div className="space-y-8">
      {/* Category Health */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Category Health
        </h3>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {categoryHealth}
        </p>
      </section>

      <Separator />

      {/* Tier 1 Shifts */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Tier 1 Narrative Shifts
        </h3>
        <div className="grid gap-3">
          {tier1Shifts.map((shift, i) => (
            <Card key={i} className="py-4">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold text-zinc-900">
                    {shift.competitor}
                  </CardTitle>
                  <EvidenceTierBadge tier={shift.evidenceTier} />
                  {shift.threatStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${threatStatusBadge[shift.threatStatus].className}`}>
                      {threatStatusBadge[shift.threatStatus].label}
                    </span>
                  )}
                  {shift.velocity && shift.velocity !== "UNKNOWN" && (
                    <span className={`text-xs font-semibold ${velocityIndicator[shift.velocity].className}`}>
                      {velocityIndicator[shift.velocity].icon} {shift.velocity.toLowerCase()}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {shift.narrative}
                </p>
                {shift.offensiveOpportunity && (
                  <div className="rounded bg-emerald-50 border border-emerald-200 px-3 py-2 mt-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">⚡ Offensive Opportunity:</p>
                    <p className="text-sm text-emerald-900">{shift.offensiveOpportunity}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {tier1Shifts.length === 0 && (
            <p className="text-sm text-zinc-400 italic">
              No major narrative shifts detected this month.
            </p>
          )}
        </div>
      </section>

      <Separator />

      {/* Tier 2 Watch */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Tier 2 Watch List
        </h3>
        <div className="space-y-2">
          {tier2Watch.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="font-medium text-zinc-600 shrink-0">
                {item.competitor}:
              </span>
              <span className="text-zinc-500">{item.signal}</span>
            </div>
          ))}
          {tier2Watch.length === 0 && (
            <p className="text-sm text-zinc-400 italic">
              No notable tier 2 signals this month.
            </p>
          )}
        </div>
      </section>

      <Separator />

      {/* Positioning Confidence */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Positioning Confidence
        </h3>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 pr-4 font-medium text-zinc-500">
                  Claim
                </th>
                <th className="text-center py-2 px-3 font-medium text-zinc-500">
                  Status
                </th>
                <th className="text-center py-2 px-3 font-medium text-zinc-500">
                  For
                </th>
                <th className="text-center py-2 px-3 font-medium text-zinc-500">
                  Against
                </th>
                <th className="text-left py-2 pl-4 font-medium text-zinc-500">
                  Assessment
                </th>
              </tr>
            </thead>
            <tbody>
              {positioningConfidence.map((claim) => (
                <tr
                  key={claim.claimId}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-zinc-700 max-w-[240px]">
                    {claim.claimText}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <ClaimStatusIndicator
                      status={claim.status}
                      claimText=""
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-green-600">
                    {claim.evidenceForCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-red-600">
                    {claim.evidenceAgainstCount}
                  </td>
                  <td className="py-2.5 pl-4 text-zinc-500 italic">
                    {claim.assessment}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Separator />

      {/* Content Implications */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          Content Implications
        </h3>
        <ul className="space-y-1.5">
          {contentImplications.map((item, i) => (
            <li
              key={i}
              className="text-sm text-zinc-700 leading-relaxed flex items-start gap-2"
            >
              <span className="text-zinc-400 mt-0.5 shrink-0">&bull;</span>
              {item}
            </li>
          ))}
          {contentImplications.length === 0 && (
            <li className="text-sm text-zinc-400 italic">
              No specific content implications this month.
            </li>
          )}
        </ul>
      </section>

      {/* Threat Status Summary (Intelligence Layer) */}
      {threatStatusSummary && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
              🎯 Threat Status Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {threatStatusSummary.critical.length > 0 && (
                <div className="rounded bg-red-50 border border-red-200 p-3">
                  <h4 className="text-xs font-semibold text-red-800 mb-2">CRITICAL</h4>
                  <ul className="space-y-1">
                    {threatStatusSummary.critical.map((c, i) => (
                      <li key={i} className="text-sm text-red-700">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {threatStatusSummary.active.length > 0 && (
                <div className="rounded bg-orange-50 border border-orange-200 p-3">
                  <h4 className="text-xs font-semibold text-orange-800 mb-2">ACTIVE</h4>
                  <ul className="space-y-1">
                    {threatStatusSummary.active.map((c, i) => (
                      <li key={i} className="text-sm text-orange-700">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {threatStatusSummary.emerging.length > 0 && (
                <div className="rounded bg-yellow-50 border border-yellow-200 p-3">
                  <h4 className="text-xs font-semibold text-yellow-800 mb-2">EMERGING</h4>
                  <ul className="space-y-1">
                    {threatStatusSummary.emerging.map((c, i) => (
                      <li key={i} className="text-sm text-yellow-700">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {threatStatusSummary.dormant.length > 0 && (
                <div className="rounded bg-zinc-50 border border-zinc-200 p-3">
                  <h4 className="text-xs font-semibold text-zinc-600 mb-2">DORMANT</h4>
                  <ul className="space-y-1">
                    {threatStatusSummary.dormant.map((c, i) => (
                      <li key={i} className="text-sm text-zinc-600">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Cross-Competitor Patterns (Intelligence Layer) */}
      {crossCompetitorPatterns && crossCompetitorPatterns.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-600 mb-4">
              🔗 Cross-Competitor Patterns
            </h3>
            <div className="grid gap-3">
              {crossCompetitorPatterns.map((pattern, i) => (
                <Card key={i} className="py-4 border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold text-purple-900">
                        {pattern.pattern}
                      </CardTitle>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        pattern.urgency === "HIGH" ? "bg-red-100 text-red-800 border-red-300" :
                        pattern.urgency === "MEDIUM" ? "bg-orange-100 text-orange-800 border-orange-300" :
                        "bg-zinc-100 text-zinc-600 border-zinc-300"
                      }`}>
                        {pattern.urgency}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-purple-700">Competitors:</span>
                      <p className="text-sm text-zinc-700 mt-0.5">{pattern.competitors.join(", ")}</p>
                    </div>
                    <div className="rounded bg-white border border-purple-300 px-3 py-2">
                      <span className="text-xs font-semibold text-purple-800">Implication:</span>
                      <p className="text-sm text-purple-900 mt-0.5">{pattern.implication}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Known Unknowns (Intelligence Layer) */}
      {knownUnknowns && knownUnknowns.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600 mb-4">
              🔍 Known Unknowns
            </h3>
            <div className="grid gap-3">
              {knownUnknowns.map((unknown, i) => (
                <Card key={i} className="py-4 border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-amber-900">
                      {unknown.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-amber-700">Why It Matters:</span>
                      <p className="text-sm text-zinc-700 mt-0.5">{unknown.whyItMatters}</p>
                    </div>
                    <div className="rounded bg-white border border-amber-300 px-3 py-2">
                      <span className="text-xs font-semibold text-amber-800">Recommended Action:</span>
                      <p className="text-sm text-amber-900 mt-0.5 font-medium">{unknown.recommendedAction}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function PulseDetail({
  type,
  content,
}: PulseDetailProps) {
  return (
    <div>
      {type === "weekly" ? (
        <WeeklyPulseDetail
          content={content as WeeklyPulseContent}
        />
      ) : (
        <MonthlyPulseDetail
          content={content as MonthlyPulseContent}
        />
      )}
    </div>
  );
}
