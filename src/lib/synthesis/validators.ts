import type { EvidenceTier } from "@/generated/prisma/client";
import type { WeeklyPulseContent, MonthlyPulseContent, SignalAlertContent } from "@/types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function countContentWords(content: WeeklyPulseContent | MonthlyPulseContent | SignalAlertContent): number {
  return countWords(JSON.stringify(content).replace(/[{}\[\]",]/g, " "));
}

export function validateWeeklyPulse(content: WeeklyPulseContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.topSignals) errors.push("Missing topSignals");
  if (!content.sections?.claimStatuses) errors.push("Missing claimStatuses");
  if (content.sections?.outlook === undefined) errors.push("Missing outlook");

  // Evidence tier check
  content.sections?.topSignals?.forEach((signal, i) => {
    if (!signal.evidenceTier) errors.push(`Signal ${i}: missing evidence tier`);
    if (!signal.sourceUrl) errors.push(`Signal ${i}: missing source URL`);
  });

  // Word limit
  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

export function validateMonthlyPulse(content: MonthlyPulseContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.categoryHealth) errors.push("Missing categoryHealth");
  if (!content.sections?.positioningConfidence) errors.push("Missing positioningConfidence");
  if (!content.sections?.contentImplications?.length) errors.push("Missing content implications");

  // Company specificity: must have positioning confidence
  if (content.sections?.positioningConfidence?.length === 0) {
    errors.push("Company specificity: no positioning claim assessments");
  }

  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

export function validateSignalAlert(content: SignalAlertContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.whatHappened) errors.push("Missing whatHappened");
  if (!content.sections?.whyItMatters) errors.push("Missing whyItMatters");
  if (!content.sections?.evidenceTier) errors.push("Missing evidenceTier");
  if (!content.sections?.recommendedResponse) errors.push("Missing recommendedResponse");

  // Company specificity check
  if (!content.sections?.claimsAffected?.length) {
    errors.push("Company specificity: no claims affected referenced");
  }

  // Source verification
  if (!content.sections?.sourceUrls?.length) {
    errors.push("Missing source URLs — every alert must cite sources");
  }

  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Tier monotonicity (U12, R6): an output can never claim a higher evidence tier
// than the best source it cites. Downgrade-only.
// ---------------------------------------------------------------------------

const TIER_RANK: Record<string, number> = {
  CONFIRMED: 3,
  INFERRED: 2,
  UNKNOWN: 1,
};

function rankToTier(rank: number): string {
  return (
    Object.entries(TIER_RANK).find(([, r]) => r === rank)?.[0] ?? "UNKNOWN"
  );
}

/**
 * An asserted tier may never exceed the strongest tier among the cited sources.
 * When there are no tiered sources at all, monotonicity is N/A here (the existing
 * source-verification rule handles "no citations") — so this returns valid and
 * does not double-fail. A violation is a plain validation failure that feeds the
 * U9 retry-with-feedback loop.
 */
export function validateTierMonotonicity(
  assertedTiers: Array<string | undefined | null>,
  sourceTiers: Array<string | undefined | null>,
): ValidationResult {
  const errors: string[] = [];
  const sourceRanks = sourceTiers
    .map((t) => (t ? TIER_RANK[t] : undefined))
    .filter((r): r is number => typeof r === "number");

  if (sourceRanks.length === 0) {
    return { valid: true, errors: [] };
  }

  const maxSourceRank = Math.max(...sourceRanks);
  for (const t of assertedTiers) {
    const rank = t ? TIER_RANK[t] : undefined;
    if (typeof rank !== "number") continue;
    if (rank > maxSourceRank) {
      errors.push(
        `Tier monotonicity: output claims ${t} but the best cited source is only ${rankToTier(maxSourceRank)}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Loss-condition rule (U16, R7): a battlecard must carry at least one honest
 * weakness / place where Finmo loses. An empty (all-"we win") section fails and
 * feeds the retry loop. Applies to the weaknesses and whyWeLose sections.
 */
export function validateLossCondition(content: unknown): ValidationResult {
  const arr = Array.isArray(content) ? content : [];
  const substantive = arr.filter((entry) => {
    if (typeof entry === "string") return entry.trim().length > 0;
    if (entry && typeof entry === "object") {
      return Object.values(entry as Record<string, unknown>).some(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
    }
    return false;
  });
  if (substantive.length === 0) {
    return {
      valid: false,
      errors: [
        "Loss-condition rule: the card must state at least one honest weakness / place where we lose — an all-'we win' card is rejected",
      ],
    };
  }
  return { valid: true, errors: [] };
}

export function validateBattlecardReframe(evidenceTier: EvidenceTier): ValidationResult {
  if (evidenceTier !== "CONFIRMED") {
    return {
      valid: false,
      errors: ["Battlecard reframes must be CONFIRMED tier only"],
    };
  }
  return { valid: true, errors: [] };
}
