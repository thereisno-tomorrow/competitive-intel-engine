import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Updated Google News RSS queries with quoted company names + domain context
const UPDATED_RSS_URLS: Record<string, string> = {
  Kyriba: "https://news.google.com/rss/search?q=%22Kyriba%22+treasury",
  Airwallex: "https://news.google.com/rss/search?q=%22Airwallex%22+fintech+payments",
  Trovata: "https://news.google.com/rss/search?q=Trovata+treasury",
  Nium: "https://news.google.com/rss/search?q=Nium+payments",
  HighRadius: "https://news.google.com/rss/search?q=%22HighRadius%22+treasury+finance",
  GTreasury: "https://news.google.com/rss/search?q=%22GTreasury%22+treasury",
};

async function main() {
  // 1. Delete all generated outputs (pulses + alerts)
  const outputs = await prisma.generatedOutput.deleteMany({});
  console.log(`Deleted ${outputs.count} generated outputs`);

  // 2. Delete all intelligence items
  const items = await prisma.intelligenceItem.deleteMany({});
  console.log(`Deleted ${items.count} intelligence items`);

  // 2b. Clear feed memory (seen articles)
  const seen = await prisma.seenArticle.deleteMany({});
  console.log(`Cleared ${seen.count} seen articles`);

  // 3. Reset all data source state (forces fresh first run)
  const sources = await prisma.dataSource.updateMany({
    data: {
      lastContentHash: null,
      lastChecked: null,
      lastChangeDetected: null,
    },
  });
  console.log(`Reset ${sources.count} data sources`);

  // 4. Update Google News RSS feed URLs with better queries
  const competitors = await prisma.competitor.findMany({
    select: { id: true, name: true },
  });

  for (const comp of competitors) {
    const newUrl = UPDATED_RSS_URLS[comp.name];
    if (!newUrl) continue;

    const updated = await prisma.dataSource.updateMany({
      where: {
        competitorId: comp.id,
        url: { contains: "news.google.com/rss/search" },
      },
      data: { url: newUrl },
    });
    if (updated.count > 0) {
      console.log(`  ${comp.name}: updated RSS URL → ${newUrl}`);
    }
  }

  // 5. Summary
  const remaining = await prisma.dataSource.findMany({
    where: { url: { contains: "news.google.com" } },
    select: { url: true },
    orderBy: { url: "asc" },
  });
  console.log(`\nGoogle News feeds after update:`);
  for (const s of remaining) {
    console.log(`  ${s.url}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
