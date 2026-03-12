import type { SourceType } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Ingestion guardrails
// ---------------------------------------------------------------------------

/**
 * Source categories determine how the ingestion pipeline handles each source type.
 *
 * EVENT: Each scraped item IS an intelligence signal (RSS articles with per-item parsing).
 *        First-run behavior: process items normally — they represent real discrete events.
 *
 * STATE: The page is a snapshot; intelligence is in the DELTA between snapshots.
 *        First-run behavior: baseline only — store hash, produce zero IntelligenceItems.
 */
export type SourceCategory = "EVENT" | "STATE";

export const SOURCE_CATEGORIES: Record<SourceType, SourceCategory> = {
  // Event sources — adapter yields discrete per-item entries
  PRESS_RSS: "EVENT",

  // State sources — intelligence is in the change, not the snapshot
  // CHANGELOG uses hash-based detection on full page blobs (same as WEBSITE),
  // so it needs baseline handling to avoid hallucinating from historical entries.
  CHANGELOG: "STATE",
  WEBSITE: "STATE",
  STATUS_PAGE: "STATE",

  // LinkedIn uses PhantomBuster — posts/jobs are discrete events, company
  // sub-adapter handles its own baseline logic internally.
  LINKEDIN: "EVENT",

  // Simulated/future types default to STATE (safe default = no hallucination)
  REVIEW: "STATE",
  JOB_POSTING: "STATE",
  SEO: "STATE",
  REGULATORY: "STATE",
} as const;

export const INGESTION = {
  /** State sources with null lastContentHash skip LLM classification (baseline only) */
  SKIP_FIRST_RUN_FOR_STATE_SOURCES: true,
  /** On first run, RSS feeds may contain 50-100 backlog articles.
   *  Cap to the N most recent to avoid timeout and excessive LLM calls. */
  MAX_ITEMS_ON_FIRST_RUN: 15,
  /** Skip RSS articles older than this many days on first run */
  MAX_ARTICLE_AGE_DAYS: 14,
  /** Maximum articles to enrich with full content per source */
  MAX_ARTICLE_ENRICHMENTS_PER_SOURCE: 10,
  /** Timeout for individual article fetch including URL resolution (ms).
   *  Budget: ~5s Google News batchexecute (2 requests) + ~5s article fetch + margin. */
  ARTICLE_FETCH_TIMEOUT_MS: 15_000,
  /** Jaccard threshold for title dedup within a single batch */
  TITLE_SIMILARITY_THRESHOLD_BATCH: 0.5,
  /** Global safety cap: max new items per run (prevents cost explosion on fresh start) */
  MAX_NEW_ITEMS_PER_RUN: 150,
} as const;

// ---------------------------------------------------------------------------
// Event-level dedup
// ---------------------------------------------------------------------------

export const DEDUP = {
  /** Ignore words shorter than this in fingerprint generation */
  MIN_WORD_LENGTH: 4,
  /** Number of significant words to include in fingerprint */
  KEY_TERM_COUNT: 5,
} as const;

// ---------------------------------------------------------------------------
// Alert thresholds
// ---------------------------------------------------------------------------

export const ALERT_THRESHOLDS = {
  /** Standalone triggers — always alert */
  pricingChange: true,
  outage: true,
  treasuryOSLanguageDetected: true,
  /** Compound triggers — only alert when positioning claim is also affected */
  claimSensitiveTypes: ["PRODUCT_CHANGE", "MESSAGING_SHIFT"] as const,
} as const;

// ---------------------------------------------------------------------------
// Signal severity scoring (supplements binary ALERT_THRESHOLDS)
// ---------------------------------------------------------------------------

/** Numeric scoring for graduated signal severity.
 *  Score = signalType[type] × competitorTier[tier] + modifiers.
 *  Compare against thresholds to determine severity level. */
export const SIGNAL_WEIGHTS = {
  competitorTier: { TIER_1: 3, TIER_2: 1 },
  signalType: {
    PRODUCT_CHANGE: 30, PRICING_CHANGE: 25, HIRING_SIGNAL: 15,
    PARTNERSHIP: 20, MESSAGING_SHIFT: 20, OUTAGE: 10,
    PRESS: 10, REVIEW: 15, SEO_CHANGE: 10, REGULATORY: 20,
  },
  affectsPositioningClaim: 20,
  treasuryOSLanguage: 30,
  inCompanyMarket: 15,
  criticalThreshold: 80,
  highThreshold: 50,
  mediumThreshold: 25,
} as const;

export const OUTPUT_LIMITS = {
  WEEKLY_PULSE_MAX_WORDS: 800,
  MONTHLY_PULSE_MAX_WORDS: 1500,
  SIGNAL_ALERT_MAX_WORDS: 700,
  MAX_REGENERATION_ATTEMPTS: 3,
  MAX_ALERTS_PER_WEEK: 3,
} as const;

export const SCHEDULE = {
  /** SGT timezone offset from UTC */
  SGT_OFFSET_HOURS: 8,
  /** Weekly pulse publishes on Monday */
  WEEKLY_PULSE_DAY: 1, // Monday = 1
  /** Monthly pulse publishes within first 5 business days */
  MONTHLY_PULSE_MAX_BUSINESS_DAY: 5,
} as const;
