import "dotenv/config";
import type { SourceType } from "../generated/prisma/client";
import { IngestionRunner } from "../lib/ingestion/runner";
import type { IngestionAdapter } from "../lib/ingestion/adapters/base";
import { WebsiteAdapter, ChangelogAdapter, StatusPageAdapter } from "../lib/ingestion/adapters/html-page";
import { RssAdapter } from "../lib/ingestion/adapters/rss";
import { ClaudeProvider } from "../lib/llm/claude";

const adapters = new Map<SourceType, IngestionAdapter>([
  ["WEBSITE", new WebsiteAdapter()],
  ["CHANGELOG", new ChangelogAdapter()],
  ["PRESS_RSS", new RssAdapter()],
  ["STATUS_PAGE", new StatusPageAdapter()],
]);

const llm = new ClaudeProvider();
const runner = new IngestionRunner(adapters, llm);

async function main() {
  console.log("Starting ingestion run...\n");
  const result = await runner.run();
  console.log("\n=== INGESTION COMPLETE ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
