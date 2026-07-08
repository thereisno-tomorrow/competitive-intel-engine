import type { PositioningClaim } from "@/generated/prisma/client";
import type { SourceCategory } from "@/lib/config/thresholds";
import { COMPANY_STRATEGIC_CONTEXT, getCompetitorProfile, CLASSIFICATION_RUBRIC } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";

const MAX_CONTENT_LENGTH = 8000;
const BATCH_MAX_CONTENT_LENGTH = 3000;

/**
 * Sharpened noteworthy/SKIP bar (U11). The classify step runs on the stronger
 * model; this bar tightens both directions — it must not drop real signal, and it
 * must not admit noise. Concrete, example-driven so the decision is reproducible.
 */
const NOTEWORTHY_BAR = `NOTEWORTHY BAR — what counts as intelligence (be precise in BOTH directions):

INCLUDE (a discrete, competitively meaningful event):
- Product/feature launches or material changes; roadmap or architecture shifts.
- Pricing or packaging changes (new tiers, price moves, model changes).
- Partnerships, integrations, funding rounds, M&A, licences/regulatory milestones.
- Executive hires/departures that signal strategy (C-suite, GM of a business line).
- Outages/incidents, security events, or messaging/positioning shifts that touch ${COMPANY_NAME}'s frame or a positioning claim.

SKIP (omit — these are noise, not intelligence):
- Marketing boilerplate, blog thought-leadership, or webinars with no underlying event.
- Round-ups / "top N vendors" listicles that mention the competitor only in passing.
- Awards, badges, or vanity PR with no strategic consequence.
- Stock-price movements, analyst ratings, or generic industry-trend pieces.
- Re-coverage of an event already tracked (dedupe to the existing eventKey instead).
- Content where the competitor is merely name-dropped, not the subject.

When genuinely unsure whether a discrete event is competitively meaningful, INCLUDE it at a lower evidence tier rather than dropping signal — but never pad with noise to look busy.`;

interface ClassifyIntelPromptContext {
  competitorName: string;
  sourceType: string;
  sourceUrl: string;
  rawContent: string;
  changeType: string;
  claims: PositioningClaim[];
  sourceCategory: SourceCategory;
  isFirstRun: boolean;
  existingEventKeys?: Array<{ eventKey: string; summary: string }>;
}

export interface ClassificationResult {
  type: string;
  summary: string;
  companyImplication: string;
  evidenceTier: string;
  affectedClaimIds: string[];
  sourceUrl: string;
  publishedAt: string;
  eventKey: string;
}

// ---------------------------------------------------------------------------
// Batch classification (EVENT sources — multiple articles per competitor)
// ---------------------------------------------------------------------------

export interface BatchClassificationEvent {
  articleIndices: number[];
  eventKey: string;
  type: string;
  summary: string;
  companyImplication: string;
  evidenceTier: string;
  affectedClaimIds: string[];
  sourceUrl: string;
  publishedAt: string;
}

export interface BatchClassificationResult {
  events: BatchClassificationEvent[];
}

interface BatchClassifyPromptContext {
  competitorName: string;
  articles: Array<{
    index: number;
    title: string;
    content: string;
    sourceUrl: string;
    sourceType: string;
    changeType: string;
    pubDate?: string;
  }>;
  claims: PositioningClaim[];
  existingEventKeys?: Array<{ eventKey: string; summary: string }>;
}

export function buildBatchClassifyPrompt(ctx: BatchClassifyPromptContext): string {
  const claimsList = ctx.claims
    .map((c) => `- [${c.id}] "${c.claimText}"`)
    .join("\n");

  const typeOptions = '"PRODUCT_CHANGE" | "PRICING_CHANGE" | "HIRING_SIGNAL" | "PARTNERSHIP" | "REVIEW" | "PRESS" | "OUTAGE" | "MESSAGING_SHIFT" | "SEO_CHANGE" | "REGULATORY"';

  const competitorProfile = getCompetitorProfile(ctx.competitorName);

  const articlesBlock = ctx.articles.map((a) => {
    const content = a.content.length > BATCH_MAX_CONTENT_LENGTH
      ? a.content.slice(0, BATCH_MAX_CONTENT_LENGTH) + "\n[...truncated]"
      : a.content;
    return `--- ARTICLE [${a.index}] ---
Title: ${a.title}
Source Type: ${a.sourceType} | Source URL: ${a.sourceUrl} | Change Type: ${a.changeType}${a.pubDate ? ` | Published: ${a.pubDate}` : ""}
${content}`;
  }).join("\n\n");

  const existingKeysBlock = ctx.existingEventKeys && ctx.existingEventKeys.length > 0
    ? `\nEXISTING EVENT KEYS FOR ${ctx.competitorName.toUpperCase()}:
If any articles describe the same real-world event as one listed below, you MUST reuse that EXACT eventKey. Do NOT create a new key for an already-tracked event. If ALL articles for an existing event are just re-coverage of something already tracked, omit them (omission = SKIP).
${ctx.existingEventKeys.map((e) => `- "${e.eventKey}" — ${e.summary}`).join("\n")}
`
    : "";

  return `You are ${COMPANY_NAME}'s competitive intelligence classifier.

${COMPANY_STRATEGIC_CONTEXT}

COMPETITOR BEING ANALYZED:
${competitorProfile}

You are classifying ${ctx.articles.length} article(s) about ${ctx.competitorName}.
Each article is from an EVENT source (RSS feed, LinkedIn). Your job is to:
1. Group articles about the SAME real-world event together
2. Classify each distinct event
3. Omit articles that are not competitively noteworthy (omission = SKIP)

ARTICLES:
${articlesBlock}

${COMPANY_NAME.toUpperCase()}'S POSITIONING CLAIMS:
${claimsList}

${CLASSIFICATION_RUBRIC}

${NOTEWORTHY_BAR}
${existingKeysBlock}
EVENTKEY FORMAT:
- Lowercase, hyphenated, no special chars. Aim for 3-6 segments.
- Structure: {company}-{what-happened}. Do NOT include dates, months, or years.
- Normalize verbs to domain nouns: "announces/appoints/adds/names" → "hires"; "launches/releases/unveils" → "launch"; "raises/secures" → "funding"; "acquires/buys" → "acquisition"
- Focus on WHAT ACTUALLY HAPPENED, not how the headline phrases it.
- Examples (different articles about the SAME event must produce the SAME key):
  "Nium Announces Three New C-Suite Hires" → "nium-c-suite-hires"
  "Nium Appointed Three C-Suite Executives (CTO, CMO, CRCO)" → "nium-c-suite-hires"
  "Kyriba Launches AI Cash Forecasting Module" → "kyriba-ai-cash-forecasting-launch"
  "Airwallex raises $300M in Series F" → "airwallex-series-f-funding"
  "Ripple Completes Acquisition of GTreasury" → "ripple-gtreasury-acquisition"

TASK: Classify these articles. Group articles about the SAME real-world event into a single event entry.
Respond with ONLY valid JSON matching this schema:
{
  "events": [
    {
      "articleIndices": number[] (indices of articles describing this event — e.g. [0, 2, 3]),
      "eventKey": string (normalized event key — IDENTICAL across runs for same event),
      "type": one of ${typeOptions},
      "summary": string (one clear factual sentence describing what happened),
      "companyImplication": string (one sentence on why this matters to ${COMPANY_NAME}'s positioning),
      "evidenceTier": "CONFIRMED" | "INFERRED" | "UNKNOWN",
      "affectedClaimIds": string[] (IDs of positioning claims affected, empty array if none),
      "sourceUrl": string (the best specific article URL from the grouped articles),
      "publishedAt": string (ISO 8601 YYYY-MM-DD or "" if unknown)
    }
  ]
}

RULES:
- If multiple articles describe the SAME real-world event, merge them into ONE event entry with all their articleIndices. Pick the best sourceUrl and most complete summary.
- Each article should appear in at most ONE event's articleIndices.
- Articles that are boilerplate, not noteworthy, or contain no competitive intelligence should NOT appear in any event — omission means SKIP.
- If ALL articles are noise, return {"events": []}.
- Pick the single most accurate type per event.
- Summary should be factual and specific (e.g. "Kyriba adds AI cash forecasting to treasury suite")
- Company implication should focus on competitive impact, not restate the summary
- Be conservative with evidence tier — use CONFIRMED only when the source directly states it
- Only include claim IDs that are genuinely affected by this signal
- For sourceUrl: prefer specific article/announcement links over generic landing pages
- For publishedAt: look for dates near headlines or article metadata — do NOT guess or invent dates
- eventKey must be IDENTICAL for articles about the same real-world event, regardless of which publisher wrote it`;
}

// ---------------------------------------------------------------------------
// Single-article classification (STATE sources + legacy)
// ---------------------------------------------------------------------------

export function buildClassifyIntelPrompt(ctx: ClassifyIntelPromptContext): string {
  const truncated = ctx.rawContent.length > MAX_CONTENT_LENGTH
    ? ctx.rawContent.slice(0, MAX_CONTENT_LENGTH) + "\n[...truncated]"
    : ctx.rawContent;

  const claimsList = ctx.claims
    .map((c) => `- [${c.id}] "${c.claimText}"`)
    .join("\n");

  const typeOptions = '"PRODUCT_CHANGE" | "PRICING_CHANGE" | "HIRING_SIGNAL" | "PARTNERSHIP" | "REVIEW" | "PRESS" | "OUTAGE" | "MESSAGING_SHIFT" | "SEO_CHANGE" | "REGULATORY" | "SKIP"';

  const contextBlock = ctx.sourceCategory === "EVENT"
    ? buildEventContext(ctx)
    : buildStateContext(ctx);

  const competitorProfile = getCompetitorProfile(ctx.competitorName);

  const existingKeysBlock = ctx.existingEventKeys && ctx.existingEventKeys.length > 0
    ? `\nEXISTING EVENT KEYS FOR ${ctx.competitorName.toUpperCase()}:
If this article describes the same real-world event as one listed below, you MUST reuse that EXACT eventKey. Do NOT create a new key for an already-tracked event.
${ctx.existingEventKeys.map((e) => `- "${e.eventKey}" — ${e.summary}`).join("\n")}
`
    : "";

  return `You are ${COMPANY_NAME}'s competitive intelligence classifier.

${COMPANY_STRATEGIC_CONTEXT}

COMPETITOR BEING ANALYZED:
${competitorProfile}

SIGNAL DETAILS:
- Competitor: ${ctx.competitorName}
- Source Type: ${ctx.sourceType}
- Source URL: ${ctx.sourceUrl}
- Change Type: ${ctx.changeType}

${contextBlock}

CONTENT:
${truncated}

${COMPANY_NAME.toUpperCase()}'S POSITIONING CLAIMS:
${claimsList}

${CLASSIFICATION_RUBRIC}

${NOTEWORTHY_BAR}

TASK: Classify this intelligence. Respond with ONLY valid JSON matching this schema:
{
  "type": one of ${typeOptions},
  "summary": string (one clear sentence describing what happened — no fluff. If type is SKIP, explain briefly why),
  "companyImplication": string (one sentence on why this matters to ${COMPANY_NAME}'s positioning. Empty string if SKIP),
  "evidenceTier": "CONFIRMED" if directly citable from source, "INFERRED" if reasonable conclusion, "UNKNOWN" if unclear,
  "affectedClaimIds": string[] (IDs of positioning claims affected, empty array if none or SKIP),
  "sourceUrl": string (the most specific article or press-release URL found in the content — look for URLs in parentheses. If no specific URL found, return the SOURCE URL above),
  "publishedAt": string (publication date if visible in content, as ISO 8601 YYYY-MM-DD. If no date found, return ""),
  "eventKey": string (a normalized key uniquely identifying the real-world event. Format: "{company}-{what-happened}". NO dates — temporal dedup is handled separately. Must be IDENTICAL across articles about the same event regardless of publisher. If type is SKIP, return "")
}

EVENTKEY FORMAT:
- Lowercase, hyphenated, no special chars. Aim for 3-6 segments.
- Structure: {company}-{what-happened}. Do NOT include dates, months, or years.
- Normalize verbs to domain nouns: "announces/appoints/adds/names" → "hires"; "launches/releases/unveils" → "launch"; "raises/secures" → "funding"; "acquires/buys" → "acquisition"
- Focus on WHAT ACTUALLY HAPPENED, not how the headline phrases it.
- Examples (different articles about the SAME event must produce the SAME key):
  "Nium Announces Three New C-Suite Hires" → "nium-c-suite-hires"
  "Nium Appointed Three C-Suite Executives (CTO, CMO, CRCO)" → "nium-c-suite-hires"
  "Kyriba Launches AI Cash Forecasting Module" → "kyriba-ai-cash-forecasting-launch"
  "Airwallex raises $300M in Series F" → "airwallex-series-f-funding"
  "Ripple Completes Acquisition of GTreasury" → "ripple-gtreasury-acquisition"
${existingKeysBlock}
RULES:
- Pick the single most accurate type
- Use "SKIP" if this content is not competitively noteworthy, is boilerplate, or contains no actionable intelligence
- Summary should be factual and specific (e.g. "Kyriba adds AI cash forecasting to treasury suite")
- Company implication should focus on competitive impact, not restate the summary
- Be conservative with evidence tier — use CONFIRMED only when the source directly states it
- Only include claim IDs that are genuinely affected by this signal
- For sourceUrl: prefer specific article/announcement links over generic landing pages
- For publishedAt: look for dates near headlines or article metadata — do NOT guess or invent dates
- eventKey must be IDENTICAL for articles about the same real-world event, regardless of which publisher wrote it`;
}

function buildEventContext(ctx: ClassifyIntelPromptContext): string {
  let sourceLabel: string;
  if (ctx.sourceType === "PRESS_RSS") {
    sourceLabel = "press/news RSS feed";
  } else if (ctx.sourceType === "LINKEDIN") {
    if (ctx.changeType === "linkedin_post") {
      sourceLabel = "LinkedIn company page post — social media content from the competitor's official LinkedIn page";
    } else if (ctx.changeType === "linkedin_job") {
      sourceLabel = "LinkedIn job listing — a hiring signal from the competitor";
    } else if (ctx.changeType === "linkedin_company_change") {
      sourceLabel = "LinkedIn company profile — a change was detected in the competitor's company information (employee count, tagline, description)";
    } else {
      sourceLabel = "LinkedIn data source";
    }
  } else {
    sourceLabel = "changelog/release notes page";
  }
  return `CONTEXT: This is a NEW ITEM from a ${sourceLabel}. Each item typically represents a discrete event (article, announcement, release). Classify it based on its content. Use SKIP if this is boilerplate, a duplicate, or not competitively meaningful.`;
}

function buildStateContext(_ctx: ClassifyIntelPromptContext): string {
  return `CONTEXT: We detected a CONTENT CHANGE on this web page. You are seeing a snapshot of the page AFTER the change was detected.

CRITICAL GUARDRAILS:
- Do NOT describe the current state of the page as if it were a new event or announcement
- Do NOT treat long-standing features, pricing tiers, or existing content as new developments
- The intelligence value is in WHAT CHANGED, not what the page currently says
- If you cannot identify a specific, recent, noteworthy change, use type "SKIP"
- Phrases like "introduced", "launched", "announced" are ONLY appropriate if the content itself explicitly says so — do not infer launch timing from a page snapshot`;
}
