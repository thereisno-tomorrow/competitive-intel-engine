/**
 * Company → registry-entry disambiguation (U20). Two modes:
 * - Direct-pin: a curated entry URL already identifies the entity — no matching.
 * - Name-search: given candidates, return ONE confident match or a loud no-match.
 *   Never guesses — an ambiguous or absent match is reported, not fabricated.
 */

export interface MatchCandidate {
  name: string;
  id: string;
  url?: string;
}

export interface MatchResult {
  matched: MatchCandidate | null;
  reason: string;
}

const SUFFIXES = /\b(inc|incorporated|corp|corporation|ltd|limited|llc|plc|pte|pvt|co|company|holdings|group|sa|nv|gmbh)\b/gi;

/** Normalize a company name for comparison: lowercase, drop punctuation + legal suffixes. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&/()]/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a query company name to exactly one candidate. A confident match requires
 * a UNIQUE candidate whose normalized name equals the query (or one fully contains
 * the other). Zero or multiple qualifying candidates → loud no-match.
 */
export function matchCompanyToEntry(
  query: string,
  candidates: MatchCandidate[],
): MatchResult {
  const q = normalizeName(query);
  if (!q) return { matched: null, reason: "empty query name" };

  const scored = candidates
    .map((c) => ({ candidate: c, norm: normalizeName(c.name) }))
    .filter(({ norm }) => norm === q || norm.includes(q) || q.includes(norm));

  // Prefer exact normalized equality if present and unique.
  const exact = scored.filter(({ norm }) => norm === q);
  if (exact.length === 1) {
    return { matched: exact[0]!.candidate, reason: "exact name match" };
  }
  if (exact.length > 1) {
    return { matched: null, reason: `ambiguous: ${exact.length} exact matches for "${query}"` };
  }

  if (scored.length === 1) {
    return { matched: scored[0]!.candidate, reason: "unique containment match" };
  }
  if (scored.length === 0) {
    return { matched: null, reason: `no match for "${query}"` };
  }
  return { matched: null, reason: `ambiguous: ${scored.length} candidates match "${query}"` };
}
