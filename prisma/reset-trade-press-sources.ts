import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TRADE_PRESS_URLS = [
  "https://www.finextra.com/rss/headlines.aspx",
  "https://fintechnews.sg/feed/",
  "https://ffnews.com/feed/",
  "https://www.prnewswire.com/rss/news-releases-list.rss",
];

const PR_NEWSWIRE_URL = "https://www.prnewswire.com/rss/news-releases-list.rss";

async function main() {
  // 1. Find all trade press sources
  const sources = await prisma.dataSource.findMany({
    where: { url: { in: TRADE_PRESS_URLS } },
    select: { id: true, url: true, competitor: { select: { name: true } } },
  });

  console.log(`Found ${sources.length} trade press sources`);

  const sourceIds = sources.map((s) => s.id);
  const prNewswireIds = sources.filter((s) => s.url === PR_NEWSWIRE_URL).map((s) => s.id);

  // 2. Clear seen_articles for all trade press sources (so they re-scan fresh)
  const deleted = await prisma.seenArticle.deleteMany({
    where: { sourceId: { in: sourceIds } },
  });
  console.log(`Cleared ${deleted.count} seen_articles entries for trade press sources`);

  // 3. Delete PR Newswire sources (403 errors)
  await prisma.dataSource.deleteMany({
    where: { id: { in: prNewswireIds } },
  });
  console.log(`Deleted ${prNewswireIds.length} PR Newswire sources (403 blocked)`);

  // 4. Reset lastContentHash on remaining trade press sources so first-run filter applies
  const remaining = sourceIds.filter((id) => !prNewswireIds.includes(id));
  await prisma.dataSource.updateMany({
    where: { id: { in: remaining } },
    data: { lastContentHash: null, lastChecked: null },
  });
  console.log(`Reset ${remaining.length} trade press sources to first-run state`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
