import type { ValidationStatus } from "@/generated/prisma/client";

/**
 * The battlecard sections that "live" — regenerated when a material signal arrives
 * (KTD6/U17). Deliberately coarse; the situational/steelman sections stay static.
 */
export const LIVING_SECTION_KEYS = [
  "weaknesses",
  "reframes",
  "whyWeLose",
  "openQuestions",
] as const;

export type LivingSectionKey = (typeof LIVING_SECTION_KEYS)[number];

/** Minimal battlecard shape the baseline extractor needs. */
interface BaselineCard {
  weaknesses: unknown;
  whyWeLose: unknown;
  openQuestions: unknown;
}

interface BaselineReframe {
  weakness: string;
  reframe: string;
  antiReframe: string;
  evidenceTier: string;
}

/**
 * Extract the current (hand-written) content for each living section from the
 * existing Battlecard + its reframe rows — the source for revision 1.
 */
export function extractBaselineContent(
  card: BaselineCard,
  reframes: BaselineReframe[],
): Record<LivingSectionKey, unknown> {
  return {
    weaknesses: card.weaknesses ?? [],
    reframes: reframes.map((r) => ({
      weakness: r.weakness,
      reframe: r.reframe,
      antiReframe: r.antiReframe,
      evidenceTier: r.evidenceTier,
    })),
    whyWeLose: card.whyWeLose ?? [],
    openQuestions: card.openQuestions ?? [],
  };
}

interface RevisionLike {
  validationStatus: ValidationStatus;
  createdAt: Date;
}

/** A revision counts as "current" only if it published (PASSED/REGENERATED). */
export function isPublishedRevision(status: ValidationStatus): boolean {
  return status === "PASSED" || status === "REGENERATED";
}

/**
 * The "current card" for a section = its latest PASSED/REGENERATED revision.
 * FLAGGED/REJECTED newer revisions are ignored (the last good one still shows).
 */
export function resolveCurrentRevision<T extends RevisionLike>(
  revisions: T[],
): T | null {
  const published = revisions.filter((r) => isPublishedRevision(r.validationStatus));
  if (published.length === 0) return null;
  return published.reduce((latest, r) =>
    r.createdAt.getTime() > latest.createdAt.getTime() ? r : latest,
  );
}
