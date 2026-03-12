import Parser from "rss-parser";
import type { SourceType } from "@/generated/prisma/client";
import type { DataSource } from "@/generated/prisma/client";
import type { IngestionAdapter, RawContent, DetectedChange } from "./base";

import { INGESTION } from "@/lib/config/thresholds";
import { normalizeGoogleNewsUrl } from "../google-news-url";

type RssItem = Parser.Item & { source?: string };

const parser: Parser<Record<string, unknown>, RssItem> = new Parser({
  customFields: {
    item: [["source", "source", { keepArray: false }]],
  },
});

export class RssAdapter implements IngestionAdapter {
  readonly sourceType: SourceType = "PRESS_RSS";

  /** Store parsed items so detectChanges can split them. */
  private lastFeedItems: RssItem[] = [];

  async fetch(source: DataSource): Promise<RawContent> {
    const feed = await parser.parseURL(source.url);
    this.lastFeedItems = feed.items ?? [];

    // Combined content for hash-based change detection
    const content = this.lastFeedItems
      .map(
        (item) => `${item.title ?? ""}\n${item.contentSnippet ?? ""}`.trim(),
      )
      .join("\n\n");

    return {
      content,
      url: source.url,
      fetchedAt: new Date(),
    };
  }

  async detectChanges(
    current: RawContent,
    previousHash: string | null,
  ): Promise<DetectedChange[]> {
    // No hash gate — always return items. URL dedup in the runner handles
    // repeat articles cheaply, so we don't need the aggregate hash shortcut.
    // This fixes the "5 runs to populate" problem where RSS feed item ordering
    // changes caused inconsistent hash-based gating.

    const isFirstRun = previousHash === null;

    let items = this.lastFeedItems
      .filter((item) => item.title || item.contentSnippet);

    // On first run, filter out old backlog articles and cap volume.
    // On subsequent runs, URL dedup in the runner handles repeat articles.
    if (isFirstRun) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - INGESTION.MAX_ARTICLE_AGE_DAYS);

      items = items
        .filter((item) => {
          const dateStr = item.pubDate ?? item.isoDate;
          if (!dateStr) return true; // no date = allow (runner dedup catches repeats)
          return new Date(dateStr) >= cutoffDate;
        })
        .sort((a, b) => {
          const dateA = new Date(a.pubDate ?? a.isoDate ?? 0).getTime();
          const dateB = new Date(b.pubDate ?? b.isoDate ?? 0).getTime();
          return dateB - dateA; // most recent first
        })
        .slice(0, INGESTION.MAX_ITEMS_ON_FIRST_RUN);
    }

    // Return one change per RSS item with individual article URLs and dates.
    // Normalize Google News RSS redirect URLs so they work in browsers.
    return items.map((item) => {
      const rawUrl = item.link ?? current.url;
      const sourceName = item.source; // e.g. "Reuters", "Fintech Singapore"
      const titleLine = item.title ?? "";
      const snippetLine = item.contentSnippet ?? "";
      const sourceLine = sourceName ? `Source: ${sourceName}` : "";

      return {
        competitorId: "",
        sourceId: "",
        changeType: "rss_new_item",
        content: [titleLine, snippetLine, sourceLine]
          .filter(Boolean)
          .join("\n")
          .trim(),
        url: normalizeGoogleNewsUrl(rawUrl),
        summary: item.title ?? `New RSS item from ${current.url}`,
        publishedAt: item.pubDate ?? item.isoDate,
      };
    });
  }
}
