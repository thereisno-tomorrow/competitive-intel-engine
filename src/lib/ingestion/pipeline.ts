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
import { LinkedInAdapter } from "./adapters/linkedin";
import { createDefaultConnectors } from "./connectors";

/**
 * Build the default adapter set. LinkedIn is included only when a PhantomBuster
 * key is configured (loud no-op otherwise). Shared by the cron route, the worker
 * job, and the manual script so the pipeline is identical everywhere.
 */
export function createDefaultAdapters(): Map<SourceType, IngestionAdapter> {
  const adapters = new Map<SourceType, IngestionAdapter>([
    ["WEBSITE", new WebsiteAdapter()],
    ["CHANGELOG", new ChangelogAdapter()],
    ["PRESS_RSS", new RssAdapter()],
    ["STATUS_PAGE", new StatusPageAdapter()],
  ]);
  if (process.env.PHANTOMBUSTER_API_KEY) {
    adapters.set("LINKEDIN", new LinkedInAdapter());
  }
  return adapters;
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
