import type {
  IntelType,
  EvidenceTier,
  SourceType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import type { IngestionAdapter } from "./adapters/base";
import { hashContent } from "./diff-engine";
import {
  buildClassifyIntelPrompt,
  buildBatchClassifyPrompt,
  type ClassificationResult,
  type BatchClassificationResult,
} from "@/lib/llm/prompts/classify-intel";
import { SOURCE_CATEGORIES, INGESTION } from "@/lib/config/thresholds";
import { resolveGoogleNewsUrl } from "./google-news-url";
import { generateEventFingerprint, fuzzyFingerprintMatch } from "./event-fingerprint";
import { fetchArticleContent } from "./article-fetcher";
import { deduplicateByTitle } from "./title-similarity";
import {
  runConnectors,
  type ConnectorRegistry,
  type Transport,
} from "./connector";
import { httpTransport } from "./transport";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_INTEL_TYPES: IntelType[] = [
  "PRODUCT_CHANGE", "PRICING_CHANGE", "HIRING_SIGNAL", "PARTNERSHIP",
  "REVIEW", "PRESS", "OUTAGE", "MESSAGING_SHIFT", "SEO_CHANGE", "REGULATORY",
];

const VALID_EVIDENCE_TIERS: EvidenceTier[] = ["CONFIRMED", "INFERRED", "UNKNOWN"];

const CONCURRENCY = 5;
const LLM_COST_PER_CALL = 0.01;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Internal pipeline item — enriched as it flows through phases. */
interface PipelineItem {
  title: string;
  url: string;
  snippet: string;
  pubDate?: string;
  changeType: string;
  competitorId: string;
  sourceId: string;
  sourceType: SourceType;
  competitorName: string;
  // Populated during enrichment
  enrichedContent?: string;
  resolvedUrl?: string;
  // Populated during classification
  classification?: ClassificationResult;
  eventFingerprint?: string;
}

export interface IngestionRunStats {
  sourcesChecked: number;
  itemsFetched: number;
  seenSkipped: number;
  prefilterSkipped: number;
  safetyCapped: number;
  titleDedupBatchSkipped: number;
  articlesEnriched: number;
  enrichmentsFailed: number;
  llmCallsMade: number;
  llmSkipped: number;
  fingerprintDedupSkipped: number;
  itemsCreated: number;
  estimatedCostUsd: number;
  durationMs: number;
  errors: Array<{ sourceId: string; error: string }>;
}

type SourceRow = Awaited<ReturnType<typeof prisma.dataSource.findMany>>[number] & {
  competitor: { name: string };
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export class IngestionRunner {
  private adapters: Map<SourceType, IngestionAdapter>;
  private llm: LLMProvider;
  private connectors: ConnectorRegistry;
  private transport: Transport;
  /** Hashes computed during collect phase — avoids double-fetching in updateEventSourceMeta */
  private eventSourceHashes = new Map<string, string>();

  constructor(
    adapters: Map<SourceType, IngestionAdapter>,
    llm: LLMProvider,
    connectors: ConnectorRegistry = {},
    transport: Transport = httpTransport,
  ) {
    this.adapters = adapters;
    this.llm = llm;
    this.connectors = connectors;
    this.transport = transport;
  }

  async run(): Promise<IngestionRunStats> {
    const start = Date.now();
    const stats = this.emptyStats();

    const [sources, claims] = await Promise.all([
      prisma.dataSource.findMany({
        where: { competitor: { status: "ACTIVE" } },
        include: { competitor: true },
      }),
      prisma.positioningClaim.findMany(),
    ]);

    const eligible = sources.filter((s) => this.adapters.has(s.type));
    const eventSources = eligible.filter(
      (s) => SOURCE_CATEGORIES[s.type] === "EVENT",
    );
    const stateSources = eligible.filter(
      (s) => SOURCE_CATEGORIES[s.type] === "STATE",
    );

    stats.sourcesChecked = eligible.length;

    // ─── PHASES 1-6: EVENT SOURCES (phased pipeline) ──────────────

    // Phase 1: COLLECT — fetch all RSS items, normalize Google News URLs
    const collected = await this.collectEventItems(eventSources, stats);
    this.log("COLLECT", `${collected.length} items from ${eventSources.length} event sources`);

    // Phase 2: REMEMBER — filter against seen_articles, record all URLs
    const newItems = await this.remember(collected, stats);
    this.log("REMEMBER", `${collected.length} → ${newItems.length} new (${stats.seenSkipped} already seen, ${stats.safetyCapped} safety-capped)`);

    // Phase 3: TITLE DEDUP (intra-batch) — collapse cross-publisher dupes
    const afterBatchDedup = deduplicateByTitle(
      newItems,
      INGESTION.TITLE_SIMILARITY_THRESHOLD_BATCH,
    );
    stats.titleDedupBatchSkipped = newItems.length - afterBatchDedup.length;
    this.log("TITLE_BATCH", `${newItems.length} → ${afterBatchDedup.length} (${stats.titleDedupBatchSkipped} cross-publisher dupes)`);

    // Phase 4: ENRICH — fetch full article content via Readability
    const enriched = await this.enrichArticles(afterBatchDedup, stats);
    this.log("ENRICH", `${afterBatchDedup.length} articles → ${stats.articlesEnriched} enriched, ${stats.enrichmentsFailed} failed`);

    // Phase 5: CLASSIFY — batch per competitor (Sonnet classification)
    const classified = await this.classifyItems(enriched, claims, stats);
    this.log("CLASSIFY", `${enriched.length} articles → ${classified.length} intel + ${stats.llmSkipped} SKIP ($${stats.estimatedCostUsd.toFixed(2)})`);

    // Phase 6: STORE — final fingerprint check (exact) + create IntelligenceItem
    await this.storeItems(classified, claims, stats);
    this.log("STORE", `${classified.length} → ${stats.itemsCreated} created (${stats.fingerprintDedupSkipped} fingerprint conflicts)`);

    // Phase 7: REMEMBER-COMMIT — record ALL collected EVENT URLs as seen only
    // now that STORE succeeded. A crash before this point leaves URLs unseen so a
    // re-run reprocesses them (no silent data loss). (R13)
    await this.recordSeen(collected);
    this.log("SEEN", `recorded ${collected.length} URLs as seen (post-store)`);

    // ─── STATE SOURCES (existing per-source logic, unchanged) ─────

    await this.processStateSources(stateSources, claims, stats);

    // ─── UPDATE EVENT SOURCE METADATA ─────────────────────────────

    await this.updateEventSourceMeta(eventSources);

    // ─── CONNECTOR SOURCES (new-source contract, U19) ─────────────

    await this.processConnectorSources(sources, claims, stats);

    stats.durationMs = Date.now() - start;
    this.log(
      "TOTAL",
      `${stats.itemsFetched} fetched → ${stats.itemsCreated} stored | $${stats.estimatedCostUsd.toFixed(2)} | ${(stats.durationMs / 1000).toFixed(1)}s`,
    );

    return stats;
  }

  // ─── Phase 1: COLLECT ─────────────────────────────────────────────

  private async collectEventItems(
    sources: SourceRow[],
    stats: IngestionRunStats,
  ): Promise<PipelineItem[]> {
    const items: PipelineItem[] = [];

    // Process sources in parallel batches
    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      const batch = sources.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (source) => {
          const adapter = this.adapters.get(source.type)!;
          const raw = await adapter.fetch(source);
          // Store hash now so we don't need to re-fetch in updateEventSourceMeta
          this.eventSourceHashes.set(source.id, hashContent(raw.content));
          const changes = await adapter.detectChanges(raw, source.lastContentHash);
          return { source, changes };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        const source = batch[j]!;
        if (result.status === "rejected") {
          stats.errors.push({
            sourceId: source.id,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          continue;
        }
        for (const change of result.value.changes) {
          items.push({
            title: change.summary,
            url: change.url,
            snippet: change.content,
            pubDate: change.publishedAt,
            changeType: change.changeType,
            competitorId: source.competitorId,
            sourceId: source.id,
            sourceType: source.type,
            competitorName: source.competitor.name,
          });
        }
      }
    }

    stats.itemsFetched = items.length;
    return items;
  }

  // ─── Phase 2: REMEMBER (feed memory) ────────────────────────────

  private async remember(
    items: PipelineItem[],
    stats: IngestionRunStats,
  ): Promise<PipelineItem[]> {
    if (items.length === 0) return [];

    // 1. Batch query: which URLs have we seen before?
    const sourceIds = [...new Set(items.map((i) => i.sourceId))];
    const urls = [...new Set(items.map((i) => i.url))];

    const alreadySeen = await prisma.seenArticle.findMany({
      where: {
        sourceId: { in: sourceIds },
        articleUrl: { in: urls },
      },
      select: { sourceId: true, articleUrl: true },
    });

    const seenSet = new Set(
      alreadySeen.map((s: { sourceId: string; articleUrl: string }) => `${s.sourceId}::${s.articleUrl}`),
    );

    // 2. Filter to genuinely new items
    const newItems: PipelineItem[] = [];
    for (const item of items) {
      const key = `${item.sourceId}::${item.url}`;
      if (seenSet.has(key)) {
        stats.seenSkipped++;
      } else {
        newItems.push(item);
      }
    }

    // NOTE: recording URLs as "seen" is deliberately deferred until AFTER a
    // successful STORE (see recordSeen, called from run()). Recording here would
    // mean a crash between REMEMBER and STORE silently loses new articles: they'd
    // be marked seen but never stored, and never reprocessed. (R13)

    // 3b. Pre-filter: drop articles that do not mention the competitor name.
    // Trade press firehose feeds contain hundreds of irrelevant articles.
    // Filtering by name match means the safety cap budget is only spent on
    // potentially relevant content.
    const mentionFiltered: PipelineItem[] = [];
    for (const item of newItems) {
      const name = item.competitorName.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(name);
      const inSnippet = item.snippet.toLowerCase().includes(name);
      if (inTitle || inSnippet) {
        mentionFiltered.push(item);
      } else {
        stats.prefilterSkipped++;
      }
    }

    // 4. Safety cap: if too many new items (fresh start), take most recent
    if (mentionFiltered.length > INGESTION.MAX_NEW_ITEMS_PER_RUN) {
      mentionFiltered.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });
      stats.safetyCapped = mentionFiltered.length - INGESTION.MAX_NEW_ITEMS_PER_RUN;
      return mentionFiltered.slice(0, INGESTION.MAX_NEW_ITEMS_PER_RUN);
    }

    return mentionFiltered;
  }

  // ─── Phase 7: REMEMBER-COMMIT (seen-after-store) ─────────────────

  /** Record collected EVENT URLs as seen. Called only after a successful STORE. */
  private async recordSeen(items: PipelineItem[]): Promise<void> {
    if (items.length === 0) return;
    const records = items.map((item) => ({
      sourceId: item.sourceId,
      articleUrl: item.url,
    }));
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
      await prisma.seenArticle.createMany({
        data: records.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
    }
  }

  // ─── Phase 6: ENRICH ─────────────────────────────────────────────

  private async enrichArticles(
    items: PipelineItem[],
    stats: IngestionRunStats,
  ): Promise<PipelineItem[]> {
    // Track enrichments per source to respect the cap
    const enrichCountBySource = new Map<string, number>();

    for (const item of items) {
      if (item.changeType !== "rss_new_item" || !item.url) continue;

      const count = enrichCountBySource.get(item.sourceId) ?? 0;
      if (count >= INGESTION.MAX_ARTICLE_ENRICHMENTS_PER_SOURCE) continue;

      const article = await fetchArticleContent(item.url, {
        timeoutMs: INGESTION.ARTICLE_FETCH_TIMEOUT_MS,
      });

      if (article) {
        item.enrichedContent = `${article.title || item.title}\n\n${article.content}`;
        item.resolvedUrl = article.resolvedUrl;
        stats.articlesEnriched++;
      } else {
        stats.enrichmentsFailed++;
      }

      enrichCountBySource.set(item.sourceId, count + 1);
    }

    return items;
  }

  // ─── Phase 5: CLASSIFY (batch per competitor) ────────────────────

  private async classifyItems(
    items: PipelineItem[],
    claims: Awaited<ReturnType<typeof prisma.positioningClaim.findMany>>,
    stats: IngestionRunStats,
  ): Promise<PipelineItem[]> {
    if (items.length === 0) return [];

    // 1. Group items by competitor
    const byCompetitor = new Map<string, PipelineItem[]>();
    for (const item of items) {
      const group = byCompetitor.get(item.competitorId) ?? [];
      group.push(item);
      byCompetitor.set(item.competitorId, group);
    }

    // 2. Fetch existing event keys for cross-run dedup context
    const competitorIds = [...byCompetitor.keys()];
    const existingEventKeys = await this.getExistingEventKeys(competitorIds);

    const classified: PipelineItem[] = [];

    // 3. Batch classify per competitor
    for (const [competitorId, competitorItems] of byCompetitor) {
      const competitorName = competitorItems[0]!.competitorName;

      // Build article list for batch prompt
      const articles = competitorItems.map((item, idx) => ({
        index: idx,
        title: item.title,
        content: item.enrichedContent ?? item.snippet,
        sourceUrl: item.resolvedUrl ?? item.url,
        sourceType: item.sourceType,
        changeType: item.changeType,
        pubDate: item.pubDate,
      }));

      let batchResult: BatchClassificationResult | null = null;
      try {
        const prompt = buildBatchClassifyPrompt({
          competitorName,
          articles,
          claims,
          existingEventKeys: existingEventKeys.get(competitorId),
        });
        // Classify uses the stronger model (U11) — protect the unvalidated
        // "is this noteworthy?" decision from cheap-model SKIP errors.
        batchResult = await this.llm.classifyStructured<BatchClassificationResult>(prompt, { step: "classify" });
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
      } catch {
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
        stats.errors.push({
          sourceId: competitorItems[0]!.sourceId,
          error: `Batch LLM classification failed for ${competitorName} (${competitorItems.length} articles)`,
        });
        continue;
      }

      // Validate response shape
      if (!batchResult?.events || !Array.isArray(batchResult.events)) {
        stats.llmSkipped += competitorItems.length;
        continue;
      }

      // Track which articles were referenced in any event
      const referencedIndices = new Set<number>();

      for (const event of batchResult.events) {
        if (event.type === "SKIP") {
          const validSkipIndices = (event.articleIndices ?? [])
            .map(Number)
            .filter((idx) => idx >= 0 && idx < competitorItems.length);
          stats.llmSkipped += validSkipIndices.length;
          for (const idx of validSkipIndices) referencedIndices.add(idx);
          continue;
        }

        // Validate articleIndices
        const validIndices = (event.articleIndices ?? [])
          .map(Number)
          .filter((idx) => idx >= 0 && idx < competitorItems.length);
        if (validIndices.length === 0) continue;

        for (const idx of validIndices) referencedIndices.add(idx);

        // Pick representative article (first valid index)
        const representativeItem = competitorItems[validIndices[0]!]!;

        // Map event fields to ClassificationResult shape
        representativeItem.classification = {
          type: event.type,
          summary: event.summary,
          companyImplication: event.companyImplication,
          evidenceTier: event.evidenceTier,
          affectedClaimIds: event.affectedClaimIds ?? [],
          sourceUrl: event.sourceUrl,
          publishedAt: event.publishedAt,
          eventKey: event.eventKey,
        };

        // Resolve final URL
        if (representativeItem.resolvedUrl) {
          // Already resolved by article fetcher
        } else if (event.sourceUrl) {
          const llmUrlHasPath = /^https?:\/\/[^/]+\/.+/.test(event.sourceUrl);
          representativeItem.resolvedUrl = llmUrlHasPath
            ? event.sourceUrl
            : await resolveGoogleNewsUrl(representativeItem.url);
        } else {
          representativeItem.resolvedUrl = await resolveGoogleNewsUrl(representativeItem.url);
        }

        // Generate event fingerprint
        representativeItem.eventFingerprint = generateEventFingerprint(
          event.eventKey,
          event.summary ?? representativeItem.title,
        );

        classified.push(representativeItem);
      }

      // Articles not referenced in any event are implicit SKIPs
      for (let i = 0; i < competitorItems.length; i++) {
        if (!referencedIndices.has(i)) {
          stats.llmSkipped++;
        }
      }
    }

    return classified;
  }

  // ─── Phase 8: STORE ──────────────────────────────────────────────

  private async storeItems(
    items: PipelineItem[],
    claims: Awaited<ReturnType<typeof prisma.positioningClaim.findMany>>,
    stats: IngestionRunStats,
  ): Promise<void> {
    const claimIds = new Set(claims.map((c) => c.id));

    for (const item of items) {
      // Safety net: exact fingerprint dedup check
      if (item.eventFingerprint) {
        const exactMatch = await prisma.intelligenceItem.findFirst({
          where: {
            eventFingerprint: item.eventFingerprint,
            competitorId: item.competitorId,
          },
          select: { id: true },
        });
        if (exactMatch) {
          stats.fingerprintDedupSkipped++;
          continue;
        }
      }

      const classification = item.classification;
      const intelType =
        classification?.type &&
        VALID_INTEL_TYPES.includes(classification.type as IntelType)
          ? (classification.type as IntelType)
          : "PRESS";

      const evidenceTier =
        classification?.evidenceTier &&
        VALID_EVIDENCE_TIERS.includes(classification.evidenceTier as EvidenceTier)
          ? (classification.evidenceTier as EvidenceTier)
          : "UNKNOWN";

      const validClaimIds = (classification?.affectedClaimIds ?? []).filter(
        (id) => claimIds.has(id),
      );

      const resolvedDate = item.pubDate
        ? new Date(item.pubDate)
        : classification?.publishedAt
          ? new Date(classification.publishedAt)
          : new Date();

      const content = item.enrichedContent ?? item.snippet;

      await prisma.intelligenceItem.create({
        data: {
          competitorId: item.competitorId,
          sourceId: item.sourceId,
          type: intelType,
          rawContent: content.slice(0, 10000),
          summary: classification?.summary ?? item.title,
          companyImplication: classification?.companyImplication ?? "",
          evidenceTier,
          sourceUrl: item.resolvedUrl ?? item.url,
          detectedAt: resolvedDate,
          eventDate: resolvedDate,
          simulated: false,
          eventFingerprint: item.eventFingerprint,
          sourceTitle: item.title,
          claimsAffected:
            validClaimIds.length > 0
              ? { connect: validClaimIds.map((id) => ({ id })) }
              : undefined,
        },
      });

      stats.itemsCreated++;
    }
  }

  // ─── STATE SOURCE PROCESSING (unchanged logic) ───────────────────

  private async processStateSources(
    sources: SourceRow[],
    claims: Awaited<ReturnType<typeof prisma.positioningClaim.findMany>>,
    stats: IngestionRunStats,
  ): Promise<void> {
    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      const batch = sources.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.allSettled(
        batch.map((source) => this.processStateSource(source, claims, stats)),
      );

      for (let j = 0; j < outcomes.length; j++) {
        const outcome = outcomes[j]!;
        const source = batch[j]!;
        if (outcome.status === "rejected") {
          stats.errors.push({
            sourceId: source.id,
            error:
              outcome.reason instanceof Error
                ? outcome.reason.message
                : String(outcome.reason),
          });
        }
      }
    }
  }

  private async processStateSource(
    source: SourceRow,
    claims: Awaited<ReturnType<typeof prisma.positioningClaim.findMany>>,
    stats: IngestionRunStats,
  ): Promise<void> {
    const adapter = this.adapters.get(source.type)!;
    const raw = await adapter.fetch(source);
    const newHash = hashContent(raw.content);
    const changes = await adapter.detectChanges(raw, source.lastContentHash);
    const isFirstRun = source.lastContentHash === null;

    // STATE first run: baseline only — store hash, skip classification
    if (
      INGESTION.SKIP_FIRST_RUN_FOR_STATE_SOURCES &&
      isFirstRun &&
      changes.length > 0
    ) {
      await prisma.dataSource.update({
        where: { id: source.id },
        data: {
          lastChecked: new Date(),
          lastContentHash: newHash,
          health: "HEALTHY",
        },
      });
      return;
    }

    // Fetch existing event keys for this competitor (cross-run dedup)
    const stateExistingKeys = await this.getExistingEventKeys([source.competitorId]);

    for (const change of changes) {
      change.competitorId = source.competitorId;
      change.sourceId = source.id;

      let classification: ClassificationResult | null = null;
      try {
        const prompt = buildClassifyIntelPrompt({
          competitorName: source.competitor.name,
          sourceType: source.type,
          sourceUrl: change.url,
          rawContent: change.content,
          changeType: change.changeType,
          claims,
          sourceCategory: "STATE",
          isFirstRun,
          existingEventKeys: stateExistingKeys.get(source.competitorId),
        });
        classification =
          await this.llm.classifyStructured<ClassificationResult>(prompt, { step: "classify" });
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
      } catch {
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
        stats.errors.push({
          sourceId: source.id,
          error: `LLM classification failed for state source`,
        });
      }

      if (classification?.type === "SKIP") {
        stats.llmSkipped++;
        continue;
      }

      const intelType =
        classification?.type &&
        VALID_INTEL_TYPES.includes(classification.type as IntelType)
          ? (classification.type as IntelType)
          : "PRESS";

      const evidenceTier =
        classification?.evidenceTier &&
        VALID_EVIDENCE_TIERS.includes(classification.evidenceTier as EvidenceTier)
          ? (classification.evidenceTier as EvidenceTier)
          : "UNKNOWN";

      const validClaimIds = (classification?.affectedClaimIds ?? []).filter(
        (id) => claims.some((c) => c.id === id),
      );

      const resolvedUrl = classification?.sourceUrl ?? change.url;

      const summary = classification?.summary ?? change.summary;
      const eventFingerprint = generateEventFingerprint(
        classification?.eventKey,
        summary,
      );

      // Fingerprint dedup for state sources (exact + fuzzy)
      const existingByFingerprint = await prisma.intelligenceItem.findFirst({
        where: { eventFingerprint, competitorId: source.competitorId },
        select: { id: true },
      });
      if (existingByFingerprint) {
        stats.fingerprintDedupSkipped++;
        continue;
      }

      const recentStateFingerprints = await prisma.intelligenceItem.findMany({
        where: {
          competitorId: source.competitorId,
          eventFingerprint: { not: null },
          detectedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { eventFingerprint: true },
        distinct: ["eventFingerprint"],
      });
      const stateFuzzyMatch = recentStateFingerprints.some(
        (existing) =>
          existing.eventFingerprint &&
          fuzzyFingerprintMatch(eventFingerprint, existing.eventFingerprint),
      );
      if (stateFuzzyMatch) {
        stats.fingerprintDedupSkipped++;
        continue;
      }

      await prisma.intelligenceItem.create({
        data: {
          competitorId: source.competitorId,
          sourceId: source.id,
          type: intelType,
          rawContent: change.content.slice(0, 10000),
          summary,
          companyImplication: classification?.companyImplication ?? "",
          evidenceTier,
          sourceUrl: resolvedUrl,
          detectedAt: new Date(),
          eventDate: new Date(),
          simulated: false,
          eventFingerprint,
          sourceTitle: change.summary,
          claimsAffected:
            validClaimIds.length > 0
              ? { connect: validClaimIds.map((id) => ({ id })) }
              : undefined,
        },
      });

      stats.itemsCreated++;
    }

    // Update source metadata
    await prisma.dataSource.update({
      where: { id: source.id },
      data: {
        lastChecked: new Date(),
        lastContentHash: newHash,
        ...(changes.length > 0
          ? { lastChangeDetected: new Date(), health: "HEALTHY" as const }
          : { health: "HEALTHY" as const }),
      },
    });
  }

  // ─── Update EVENT source metadata ────────────────────────────────

  private async updateEventSourceMeta(sources: SourceRow[]): Promise<void> {
    for (const source of sources) {
      const storedHash = this.eventSourceHashes.get(source.id);
      await prisma.dataSource.update({
        where: { id: source.id },
        data: {
          lastChecked: new Date(),
          ...(storedHash ? { lastContentHash: storedHash, health: "HEALTHY" as const } : {}),
        },
      });
    }
  }

  // ─── CONNECTOR SOURCES (U19) ─────────────────────────────────────

  /**
   * Process sources whose type has a registered connector (SEC/regulatory, jobs,
   * SEO, LinkedIn). Runs the connector fan-out (isolated + budgeted), then
   * classifies + stores each emitted content as a discrete intel item with
   * seen-URL + fingerprint dedup. Connectors never assign a tier — classification
   * does (KTD7). Additive: the EVENT/STATE adapter paths are untouched.
   */
  private async processConnectorSources(
    sources: SourceRow[],
    claims: Awaited<ReturnType<typeof prisma.positioningClaim.findMany>>,
    stats: IngestionRunStats,
  ): Promise<void> {
    const connectorSources = sources
      .filter((s) => this.connectors[s.type])
      .map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        competitorId: s.competitorId,
        competitorName: s.competitor.name,
      }));
    if (connectorSources.length === 0) return;

    stats.sourcesChecked += connectorSources.length;

    const { content, errors } = await runConnectors(
      this.connectors,
      connectorSources,
      this.transport,
      { budget: INGESTION.MAX_NEW_ITEMS_PER_RUN },
    );
    for (const e of errors) stats.errors.push(e);
    stats.itemsFetched += content.length;

    if (content.length === 0) return;

    const claimIds = new Set(claims.map((c) => c.id));
    const competitorIds = [...new Set(content.map((c) => c.competitorId))];
    const existingKeys = await this.getExistingEventKeys(competitorIds);

    for (const item of content) {
      // Seen dedup (URL already ingested from this source) — feed memory.
      const seen = await prisma.seenArticle.findUnique({
        where: { sourceId_articleUrl: { sourceId: item.sourceId, articleUrl: item.url } },
        select: { id: true },
      });
      if (seen) {
        stats.seenSkipped++;
        continue;
      }

      let classification: ClassificationResult | null = null;
      try {
        const prompt = buildClassifyIntelPrompt({
          competitorName:
            connectorSources.find((s) => s.id === item.sourceId)?.competitorName ?? "",
          sourceType: item.sourceType,
          sourceUrl: item.url,
          rawContent: item.text,
          changeType: "connector_item",
          claims,
          sourceCategory: "EVENT",
          isFirstRun: false,
          existingEventKeys: existingKeys.get(item.competitorId),
        });
        classification = await this.llm.classifyStructured<ClassificationResult>(prompt, {
          step: "classify",
        });
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
      } catch {
        stats.llmCallsMade++;
        stats.estimatedCostUsd += LLM_COST_PER_CALL;
        stats.errors.push({ sourceId: item.sourceId, error: "connector classify failed" });
      }

      if (classification?.type === "SKIP") {
        stats.llmSkipped++;
        // Record as seen so we don't re-classify the same surface every run.
        await prisma.seenArticle.create({
          data: { sourceId: item.sourceId, articleUrl: item.url },
        }).catch(() => {});
        continue;
      }

      const intelType =
        classification?.type && VALID_INTEL_TYPES.includes(classification.type as IntelType)
          ? (classification.type as IntelType)
          : "PRESS";
      const evidenceTier =
        classification?.evidenceTier &&
        VALID_EVIDENCE_TIERS.includes(classification.evidenceTier as EvidenceTier)
          ? (classification.evidenceTier as EvidenceTier)
          : "UNKNOWN";
      const validClaimIds = (classification?.affectedClaimIds ?? []).filter((id) =>
        claimIds.has(id),
      );
      const summary = classification?.summary ?? item.title;
      const fingerprint = generateEventFingerprint(classification?.eventKey, summary);

      const exists = await prisma.intelligenceItem.findFirst({
        where: { eventFingerprint: fingerprint, competitorId: item.competitorId },
        select: { id: true },
      });
      if (exists) {
        stats.fingerprintDedupSkipped++;
        await prisma.seenArticle.create({
          data: { sourceId: item.sourceId, articleUrl: item.url },
        }).catch(() => {});
        continue;
      }

      await prisma.intelligenceItem.create({
        data: {
          competitorId: item.competitorId,
          sourceId: item.sourceId,
          type: intelType,
          rawContent: item.text.slice(0, 10000),
          summary,
          companyImplication: classification?.companyImplication ?? "",
          evidenceTier,
          sourceUrl: classification?.sourceUrl || item.url,
          detectedAt: new Date(),
          eventDate: item.publishedAt ? new Date(item.publishedAt) : new Date(),
          simulated: false,
          eventFingerprint: fingerprint,
          sourceTitle: item.title,
          claimsAffected:
            validClaimIds.length > 0
              ? { connect: validClaimIds.map((id) => ({ id })) }
              : undefined,
        },
      });
      stats.itemsCreated++;

      // Record seen only after a successful store (R13, same discipline as EVENT).
      await prisma.seenArticle.create({
        data: { sourceId: item.sourceId, articleUrl: item.url },
      }).catch(() => {});
    }
  }

  // ─── Existing event key helpers ──────────────────────────────────

  /** Fetch recent event fingerprints + summaries for LLM context injection. */
  private async getExistingEventKeys(
    competitorIds: string[],
  ): Promise<Map<string, Array<{ eventKey: string; summary: string }>>> {
    if (competitorIds.length === 0) return new Map();

    const recentItems = await prisma.intelligenceItem.findMany({
      where: {
        competitorId: { in: competitorIds },
        eventFingerprint: { not: null },
        detectedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        competitorId: true,
        eventFingerprint: true,
        summary: true,
      },
      distinct: ["eventFingerprint"],
      orderBy: { detectedAt: "desc" },
    });

    const map = new Map<string, Array<{ eventKey: string; summary: string }>>();
    for (const item of recentItems) {
      if (!item.eventFingerprint) continue;
      const list = map.get(item.competitorId) ?? [];
      list.push({ eventKey: item.eventFingerprint, summary: item.summary });
      map.set(item.competitorId, list);
    }
    return map;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private log(phase: string, message: string): void {
    console.log(`[${phase}] ${message}`);
  }

  private emptyStats(): IngestionRunStats {
    return {
      sourcesChecked: 0,
      itemsFetched: 0,
      seenSkipped: 0,
      prefilterSkipped: 0,
      safetyCapped: 0,
      titleDedupBatchSkipped: 0,
      articlesEnriched: 0,
      enrichmentsFailed: 0,
      llmCallsMade: 0,
      llmSkipped: 0,
      fingerprintDedupSkipped: 0,
      itemsCreated: 0,
      estimatedCostUsd: 0,
      durationMs: 0,
      errors: [],
    };
  }
}
