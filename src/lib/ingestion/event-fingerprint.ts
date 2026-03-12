/**
 * Event-level dedup via LLM-generated canonical event keys.
 *
 * The LLM classification prompt now returns an `eventKey` — a normalized,
 * human-readable identifier like "nium-c-suite-hires-2026-02" that stays
 * identical across publishers covering the same event.
 *
 * Falls back to the legacy word-extraction + SHA-256 algorithm when the
 * LLM fails or returns no eventKey.
 */

import { createHash } from "crypto";
import { DEDUP } from "@/lib/config/thresholds";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
  "has", "had", "have", "will", "would", "could", "should", "may", "might",
  "its", "it", "this", "that", "these", "those", "their", "our", "your",
  "his", "her", "not", "into", "over", "also", "than", "more", "most",
  "new", "about", "says", "said", "per", "via", "each", "all", "any",
]);

/**
 * Generate event fingerprint for dedup.
 *
 * If the LLM provided an eventKey, normalize and use it directly.
 * Falls back to legacy word-extraction + SHA-256 if no eventKey.
 */
export function generateEventFingerprint(
  eventKey: string | undefined,
  summaryFallback: string,
): string {
  if (eventKey?.trim()) {
    // Normalize: lowercase, collapse whitespace to hyphens
    let normalized = eventKey.trim().toLowerCase().replace(/\s+/g, "-");
    // Strip trailing date patterns the LLM might add despite instructions
    // Matches: -2026-02, -2026, -02 (trailing month-only)
    normalized = normalized.replace(/-\d{4}(-\d{2})?$/, "");
    return normalized;
  }

  // Legacy fallback for LLM failures
  const words = summaryFallback
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= DEDUP.MIN_WORD_LENGTH && !STOP_WORDS.has(w));

  const keyTerms = words.slice(0, DEDUP.KEY_TERM_COUNT).sort();
  const input = keyTerms.join("|");

  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Fuzzy match two event fingerprints by word-segment overlap.
 *
 * Splits by hyphens, computes overlap. Returns true if segments share
 * enough in common to likely be the same event described differently.
 *
 * Example:
 *   "ripple-gtreasury-acquisition" vs "ripple-gtreasury-partnership"
 *   Shared: {ripple, gtreasury} = 2, each has 1 unique → match
 */
export function fuzzyFingerprintMatch(
  fp1: string,
  fp2: string,
  options?: { minSharedSegments?: number; maxDifferentSegments?: number },
): boolean {
  const minShared = options?.minSharedSegments ?? 2;
  const maxDiff = options?.maxDifferentSegments ?? 1;

  const segs1 = new Set(fp1.split("-").filter((s) => s.length > 0));
  const segs2 = new Set(fp2.split("-").filter((s) => s.length > 0));

  // Skip legacy hex fingerprints (no hyphens → single segment)
  if (segs1.size <= 1 || segs2.size <= 1) return false;

  let shared = 0;
  for (const seg of segs1) {
    if (segs2.has(seg)) shared++;
  }

  const onlyIn1 = segs1.size - shared;
  const onlyIn2 = segs2.size - shared;

  return shared >= minShared && onlyIn1 <= maxDiff && onlyIn2 <= maxDiff;
}
