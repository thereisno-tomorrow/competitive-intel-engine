import type { SourceType } from "@/generated/prisma/client";
import type { DataSource } from "@/generated/prisma/client";
import type { IngestionAdapter, RawContent, DetectedChange } from "./base";
import {
  extractTextContent,
  extractTextWithLinks,
  hasContentChanged,
} from "../diff-engine";

interface HtmlPageAdapterConfig {
  sourceType: SourceType;
  changeType: string;
  timeoutMs: number;
  preserveLinks: boolean;
  alertKeywords?: string[];
}

const CONFIGS: Record<"WEBSITE" | "CHANGELOG" | "STATUS_PAGE", HtmlPageAdapterConfig> = {
  WEBSITE: {
    sourceType: "WEBSITE",
    changeType: "content_change",
    timeoutMs: 15_000,
    preserveLinks: true,
  },
  CHANGELOG: {
    sourceType: "CHANGELOG",
    changeType: "changelog_update",
    timeoutMs: 30_000,
    preserveLinks: false,
  },
  STATUS_PAGE: {
    sourceType: "STATUS_PAGE",
    changeType: "status_change",
    timeoutMs: 15_000,
    preserveLinks: false,
    alertKeywords: [
      "degraded",
      "outage",
      "maintenance",
      "incident",
      "disruption",
      "downtime",
    ],
  },
};

export class HtmlPageAdapter implements IngestionAdapter {
  readonly sourceType: SourceType;
  private config: HtmlPageAdapterConfig;

  constructor(type: "WEBSITE" | "CHANGELOG" | "STATUS_PAGE") {
    this.config = CONFIGS[type];
    this.sourceType = this.config.sourceType;
  }

  async fetch(source: DataSource): Promise<RawContent> {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "CompetitiveIntelEngine/1.0" },
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${source.url}: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const textContent = this.config.preserveLinks
      ? extractTextWithLinks(html)
      : extractTextContent(html);

    return {
      content: textContent,
      url: source.url,
      fetchedAt: new Date(),
    };
  }

  async detectChanges(
    current: RawContent,
    previousHash: string | null,
  ): Promise<DetectedChange[]> {
    if (!hasContentChanged(current.content, previousHash)) {
      return [];
    }

    const label = this.config.changeType.replace("_", " ");
    let summary = `${label.charAt(0).toUpperCase()}${label.slice(1)} detected at ${current.url}`;

    if (this.config.alertKeywords) {
      const contentLower = current.content.toLowerCase();
      const isAlertWorthy = this.config.alertKeywords.some((keyword) =>
        contentLower.includes(keyword),
      );
      if (isAlertWorthy) {
        summary = `ALERT: Status issue detected at ${current.url} | isAlertWorthy: true`;
      }
    }

    return [
      {
        competitorId: "", // Set by runner
        sourceId: "", // Set by runner
        changeType: this.config.changeType,
        content: current.content,
        url: current.url,
        summary,
      },
    ];
  }
}

// Convenience exports for backward compatibility with existing imports
export class WebsiteAdapter extends HtmlPageAdapter {
  constructor() { super("WEBSITE"); }
}

export class ChangelogAdapter extends HtmlPageAdapter {
  constructor() { super("CHANGELOG"); }
}

export class StatusPageAdapter extends HtmlPageAdapter {
  constructor() { super("STATUS_PAGE"); }
}
