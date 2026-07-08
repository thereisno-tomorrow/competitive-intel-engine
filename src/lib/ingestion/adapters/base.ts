import type { DataSource, SourceType } from "@/generated/prisma/client";

export interface RawContent {
  content: string;
  url: string;
  fetchedAt: Date;
  /**
   * Adapter-specific parsed payload passed from fetch() to detectChanges().
   * Carrying it here (instead of on adapter instance state) keeps adapters
   * stateless and safe to share across concurrent sources.
   */
  payload?: unknown;
}

export interface DetectedChange {
  competitorId: string;
  sourceId: string;
  changeType: string;
  content: string;
  url: string;
  summary: string;
  publishedAt?: string;
}

export interface IngestionAdapter {
  readonly sourceType: SourceType;
  fetch(source: DataSource): Promise<RawContent>;
  detectChanges(
    current: RawContent,
    previousHash: string | null,
  ): Promise<DetectedChange[]>;
}
