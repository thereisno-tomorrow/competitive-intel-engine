"use client";

import { useState } from "react";
import type { SignalAlertContent } from "@/types";
import { EvidenceTierBadge } from "@/components/shared/evidence-tier-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AlertCardProps {
  alert: {
    id: string;
    headline: string;
    publishedAt: string;
    content: SignalAlertContent;
  };
}

export function AlertCard({ alert }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { sections } = alert.content;

  const formattedDate = new Date(alert.publishedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );

  return (
    <Card
      className="py-3 cursor-pointer transition-all hover:border-zinc-300 hover:shadow-sm"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-zinc-800 leading-snug">
              {alert.headline}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <EvidenceTierBadge tier={sections.evidenceTier} />
            <span className="text-xs text-zinc-400">{formattedDate}</span>
            <span className="text-xs text-zinc-400 w-4 text-center">
              {expanded ? "\u2212" : "+"}
            </span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent
          className="space-y-4 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {/* What Happened */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              What Happened
            </h4>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {sections.whatHappened}
            </p>
          </div>

          {/* Why It Matters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Why It Matters
            </h4>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {sections.whyItMatters}
            </p>
          </div>

          {/* Recommended Response */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Recommended Response
            </h4>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {sections.recommendedResponse}
            </p>
          </div>

          {/* Action Items */}
          {sections.actionItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Action Items
              </h4>
              <ul className="space-y-1.5">
                {sections.actionItems.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-zinc-700 leading-relaxed flex items-start gap-2"
                  >
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Claims Affected */}
          {sections.claimsAffected.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Claims Affected
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {sections.claimsAffected.map((claim, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200/60"
                  >
                    {claim}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sections.sourceUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Source
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {sections.sourceUrls.map((url, i) => {
                  const isGoogleNews =
                    /^https?:\/\/news\.google\.com\/articles\//i.test(url);
                  let label: string;
                  try {
                    label = isGoogleNews
                      ? "View article"
                      : new URL(url).hostname.replace(/^www\./, "");
                  } catch {
                    label = "Source";
                  }
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>↗</span>
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
