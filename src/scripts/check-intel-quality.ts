import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const items = await prisma.intelligenceItem.findMany({
    orderBy: { detectedAt: "desc" },
    select: {
      id: true,
      type: true,
      summary: true,
      sourceUrl: true,
      evidenceTier: true,
      rawContent: true,
      competitor: { select: { name: true } },
    },
  });

  console.log(`\n=== ${items.length} Intelligence Items ===\n`);
  for (const item of items) {
    const contentLen = item.rawContent?.length ?? 0;
    const isSnippetOnly = contentLen < 200;
    console.log(`[${item.competitor.name}] ${item.type} | ${item.evidenceTier} | content: ${contentLen} chars ${isSnippetOnly ? "⚠ SNIPPET ONLY" : ""}`);
    console.log(`  Summary: ${item.summary}`);
    console.log(`  URL: ${item.sourceUrl}`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
