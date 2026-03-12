import "dotenv/config";
import { PrismaClient, SourceType, SourceCadence } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TRADE_PRESS_FEEDS = [
  { url: "https://www.finextra.com/rss/headlines.aspx", label: "Finextra" },
  { url: "https://fintechnews.sg/feed/", label: "Fintech Singapore" },
  { url: "https://ffnews.com/feed/", label: "FF News" },
  { url: "https://www.prnewswire.com/rss/news-releases-list.rss", label: "PR Newswire" },
];

async function main() {
  const competitors = await prisma.competitor.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${competitors.length} active competitors:`);
  competitors.forEach((c) => console.log(`  - ${c.name} (${c.id})`));
  console.log();

  let created = 0;
  let skipped = 0;

  for (const competitor of competitors) {
    for (const feed of TRADE_PRESS_FEEDS) {
      const existing = await prisma.dataSource.findFirst({
        where: { competitorId: competitor.id, url: feed.url },
      });

      if (existing) {
        console.log(`  SKIP (exists): ${competitor.name} — ${feed.label}`);
        skipped++;
        continue;
      }

      await prisma.dataSource.create({
        data: {
          competitorId: competitor.id,
          type: SourceType.PRESS_RSS,
          url: feed.url,
          cadence: SourceCadence.DAILY,
          health: "HEALTHY",
        },
      });

      console.log(`  CREATED: ${competitor.name} — ${feed.label}`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
