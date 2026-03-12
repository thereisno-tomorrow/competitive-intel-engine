import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Broader queries + tbs=qdr:m (past month) to surface recent articles
const UPDATES: Record<string, string> = {
  "Kyriba":     "https://news.google.com/rss/search?q=%22Kyriba%22&tbs=qdr:m",
  "Airwallex":  "https://news.google.com/rss/search?q=%22Airwallex%22&tbs=qdr:m",
  "Trovata":    "https://news.google.com/rss/search?q=%22Trovata%22+treasury&tbs=qdr:m",
  "Nium":       "https://news.google.com/rss/search?q=%22Nium%22+payments&tbs=qdr:m",
  "HighRadius": "https://news.google.com/rss/search?q=%22HighRadius%22&tbs=qdr:m",
  "GTreasury":  "https://news.google.com/rss/search?q=%22GTreasury%22+OR+%22Ripple+Treasury%22&tbs=qdr:m",
};

async function main() {
  for (const [competitorName, newUrl] of Object.entries(UPDATES)) {
    const competitor = await prisma.competitor.findFirst({
      where: { name: competitorName },
      select: { id: true },
    });
    if (!competitor) { console.log(`  SKIP: competitor ${competitorName} not found`); continue; }

    // Find the existing Google News RSS source
    const source = await prisma.dataSource.findFirst({
      where: {
        competitorId: competitor.id,
        type: "PRESS_RSS",
        url: { contains: "news.google.com" },
      },
    });
    if (!source) { console.log(`  SKIP: no Google News source for ${competitorName}`); continue; }

    // Clear seen_articles for this source
    const cleared = await prisma.seenArticle.deleteMany({ where: { sourceId: source.id } });

    // Update URL and reset to first-run state
    await prisma.dataSource.update({
      where: { id: source.id },
      data: { url: newUrl, lastContentHash: null, lastChecked: null },
    });

    console.log(`  UPDATED: ${competitorName} → ${newUrl}`);
    console.log(`           Cleared ${cleared.count} seen_articles`);
  }

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
