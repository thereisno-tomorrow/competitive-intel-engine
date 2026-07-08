import type { CompetitorTier, IntelType } from "@/generated/prisma/client";
import { evaluateAlertThreshold } from "@/lib/synthesis/alert-evaluator";
import { LIVING_SECTION_KEYS, type LivingSectionKey } from "./sections";

/**
 * A signal is "material" (worth regenerating a card for) exactly when it would
 * trigger a signal alert — pricing change, outage, or a positioning-claim-affecting
 * / category-threat event. Reuses the existing alert-evaluator logic (U17).
 */
export interface MaterialSignalInput {
  competitorTier: CompetitorTier;
  intelType: IntelType;
  content: string;
  affectsPositioningClaims: boolean;
}

export function isMaterialSignal(input: MaterialSignalInput): boolean {
  return evaluateAlertThreshold(input).shouldAlert;
}

/**
 * Which card sections a material signal can change. Deliberately coarse for now
 * (all living sections) — refine per signal type later. Kept as a function so the
 * mapping has one home.
 */
export function affectedSections(): readonly LivingSectionKey[] {
  return LIVING_SECTION_KEYS;
}

/** An intelligence item enriched with the fields materiality needs. */
export interface RetargetItem {
  competitorId: string;
  competitor: { tier: CompetitorTier };
  type: IntelType;
  rawContent: string;
  claimsAffected: unknown[];
}

/**
 * Reduce a batch of freshly-stored items to the unique set of competitors that
 * received a material signal — the competitors whose cards should regenerate.
 * De-duped at the competitor level (KTD6): two material signals for X → one X.
 */
export function materialCompetitorIds(items: RetargetItem[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const material = isMaterialSignal({
      competitorTier: item.competitor.tier,
      intelType: item.type,
      content: item.rawContent,
      affectsPositioningClaims: item.claimsAffected.length > 0,
    });
    if (material) ids.add(item.competitorId);
  }
  return [...ids];
}
