import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Rubric {
  version: string;
  text: string;
}

/** Default location of the owner-editable strategy/rubric file. */
export const RUBRIC_PATH = join(process.cwd(), "docs", "rubric", "gtm-analysis-rubric.md");

const VERSION_RE = /\*\*Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/;

const cache = new Map<string, Rubric>();

/**
 * Load the strategy/rubric file (text + version). Hard-fails loudly if the file
 * is missing or has no parseable version header — never a silent stale default.
 * Cached per path (read once per process).
 */
export function loadRubric(path: string = RUBRIC_PATH): Rubric {
  const cached = cache.get(path);
  if (cached) return cached;

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Rubric file not found at ${path}. The owner-editable strategy file is required for output generation and judging.`,
    );
  }

  const match = text.match(VERSION_RE);
  if (!match) {
    throw new Error(
      `Rubric file at ${path} has no parseable "**Version:** X.Y.Z" header.`,
    );
  }

  const rubric: Rubric = { version: match[1]!, text };
  cache.set(path, rubric);
  return rubric;
}

/** Clear the cache (tests / after an edit within a long-running process). */
export function resetRubricCache(): void {
  cache.clear();
}
