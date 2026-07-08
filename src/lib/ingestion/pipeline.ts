import type { SourceType } from "@/generated/prisma/client";
import type { LLMProvider } from "@/lib/llm/provider";
import { IngestionRunner } from "./runner";
import type { IngestionAdapter } from "./adapters/base";
import {
  WebsiteAdapter,
  ChangelogAdapter,
  StatusPageAdapter,
} from "./adapters/html-page";
import { RssAdapter } from "./adapters/rss";
import { createDefaultConnectors } from "./connectors";

/**
 * Build the default adapter set (EVENT/STATE sources). LinkedIn now flows through
 * the connector registry (U23), not an adapter — kept out here to avoid
 * double-ingestion. Shared by the cron route, worker job, and manual script.
 */
export function createDefaultAdapters(): Map<SourceType, IngestionAdapter> {
  return new Map<SourceType, IngestionAdapter>([
    ["WEBSITE", new WebsiteAdapter()],
    ["CHANGELOG", new ChangelogAdapter()],
    ["PRESS_RSS", new RssAdapter()],
    ["STATUS_PAGE", new StatusPageAdapter()],
  ]);
}

/** Run the full ingestion pipeline with the default adapters + connectors. */
export function runIngestionPipeline(llm: LLMProvider) {
  const runner = new IngestionRunner(
    createDefaultAdapters(),
    llm,
    createDefaultConnectors(),
  );
  return runner.run();
}
