/**
 * Pre-LLM title-based dedup using stemmed keyword Jaccard similarity.
 *
 * Catches cross-publisher duplicates like:
 *   "Nium Announces Three New C-Suite Hires"
 *   "Nium Appointed Three C-Suite Executives"
 *
 * Runs before the expensive Sonnet classification call — completely free.
 */

const STOP_WORDS = new Set([
  // Standard English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
  "has", "had", "have", "will", "would", "could", "should", "may", "might",
  "its", "it", "this", "that", "these", "those", "their", "our", "your",
  "his", "her", "not", "into", "over", "also", "than", "more", "most",
  "new", "about", "says", "said", "per", "via", "each", "all", "any",
  // News-domain noise
  "announces", "announced", "launches", "launched", "reports", "reported",
  "reveals", "revealed", "unveils", "unveiled", "expands", "expanded",
  "partners", "partnered", "introduces", "introduced", "secures", "secured",
  "names", "named", "appoints", "appointed", "adds", "added", "joins",
  "joined", "company", "firm", "group", "inc", "ltd", "corp", "global",
  "international", "according", "report", "update", "now",
]);

/** Minimal suffix stripping — not a real stemmer, just enough for news dedup. */
function stem(word: string): string {
  if (word.length <= 4) return word;
  // Order matters: try longer suffixes first
  if (word.endsWith("tion")) return word.slice(0, -4);
  if (word.endsWith("ment")) return word.slice(0, -4);
  if (word.endsWith("ness")) return word.slice(0, -4);
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("ed")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Tokenize a title into sorted, stemmed, unique keywords. */
export function titleTokens(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // keep letters, digits, spaces, hyphens
    .replace(/-/g, " ")              // treat hyphens as word separators
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map(stem);

  return [...new Set(words)].sort();
}

/** Jaccard similarity on stemmed title token sets. Returns 0–1. */
export function titleSimilarity(a: string, b: string): number {
  const setA = new Set(titleTokens(a));
  const setB = new Set(titleTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Deduplicate items within a batch by title similarity.
 * Groups by competitorId, then clusters by title overlap.
 * Keeps one item per cluster: longest content, then most recent.
 */
export function deduplicateByTitle<
  T extends { title: string; competitorId: string; snippet: string; pubDate?: string },
>(items: T[], threshold: number): T[] {
  // Group by competitor
  const byCompetitor = new Map<string, T[]>();
  for (const item of items) {
    const group = byCompetitor.get(item.competitorId) ?? [];
    group.push(item);
    byCompetitor.set(item.competitorId, group);
  }

  const result: T[] = [];

  for (const group of byCompetitor.values()) {
    // Track which items are already absorbed into a cluster
    const absorbed = new Set<number>();

    for (let i = 0; i < group.length; i++) {
      if (absorbed.has(i)) continue;

      // Start a new cluster with this item
      const cluster: T[] = [group[i]!];

      for (let j = i + 1; j < group.length; j++) {
        if (absorbed.has(j)) continue;
        if (titleSimilarity(group[i]!.title, group[j]!.title) >= threshold) {
          cluster.push(group[j]!);
          absorbed.add(j);
        }
      }

      // Pick the best item from the cluster
      cluster.sort((a, b) => {
        // Prefer longer content (more enrichment potential)
        const lenDiff = b.snippet.length - a.snippet.length;
        if (lenDiff !== 0) return lenDiff;
        // Then prefer most recent
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });
      result.push(cluster[0]!);
    }
  }

  return result;
}
