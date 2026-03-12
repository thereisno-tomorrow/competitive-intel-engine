"use client";

import { useClaims } from "@/lib/hooks/use-claims";
import { ClaimStatusIndicator } from "@/components/shared/claim-status-indicator";

export function ClaimsStrip() {
  const { data: claims, isLoading } = useClaims();

  if (isLoading) {
    return (
      <div className="border-b border-brand-100/60 bg-white px-6 py-3">
        <div className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!claims?.length) return null;

  return (
    <div className="bg-zinc-50 py-6">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">
              Positioning Claims
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              3 defensible market positions — tracked against live competitor evidence
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 px-5 py-4">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-3.5 py-2.5"
              >
                <ClaimStatusIndicator
                  status={claim.status}
                  claimText={claim.claimText}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
