import "dotenv/config";
import type { SourceType } from "@/generated/prisma/client";
import type { IngestionAdapter } from "@/lib/ingestion/adapters/base";

// This script runs ingestion locally but writes to your Vercel (production) database
// It bypasses Vercel's 10-second timeout limitation on the free tier

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;

if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set in .env");
  process.exit(1);
}

// Temporarily override DATABASE_URL to point to production
const originalDbUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = vercelDbUrl;

console.log("🔄 Running ingestion against production database...\n");
console.log("⏱️  This will take several minutes. Please wait...\n");

async function main() {
  // Import after setting DATABASE_URL
  const { IngestionRunner } = await import("@/lib/ingestion/runner");
  const {
    WebsiteAdapter,
    ChangelogAdapter,
    StatusPageAdapter,
  } = await import("@/lib/ingestion/adapters/html-page");
  const { RssAdapter } = await import("@/lib/ingestion/adapters/rss");
  const { LinkedInAdapter } = await import("@/lib/ingestion/adapters/linkedin");
  const { ClaudeProvider } = await import("@/lib/llm/claude");

  const adapters = new Map<SourceType, IngestionAdapter>([
    ["WEBSITE", new WebsiteAdapter()],
    ["CHANGELOG", new ChangelogAdapter()],
    ["PRESS_RSS", new RssAdapter()],
    ["STATUS_PAGE", new StatusPageAdapter()],
  ]);

  // LinkedIn adapter requires PhantomBuster API key
  if (process.env.PHANTOMBUSTER_API_KEY) {
    adapters.set("LINKEDIN", new LinkedInAdapter());
  }

  const llm = new ClaudeProvider();
  const runner = new IngestionRunner(adapters, llm);

  try {
    const result = await runner.run();
    console.log("\n✅ Ingestion complete!");
    console.log(`\n📊 Results:`);
    console.log(`   - Sources checked: ${result.sourcesChecked}`);
    console.log(`   - Items created: ${result.itemsCreated}`);
    console.log(`   - Errors: ${result.errors.length}`);
    console.log("\n🚀 Check your site to see the new intel!");
  } catch (err) {
    console.error("\n❌ Ingestion failed:", err);
    process.exit(1);
  } finally {
    // Restore original DATABASE_URL
    process.env.DATABASE_URL = originalDbUrl;
  }
}

main();
