import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const items = await prisma.intelligenceItem.findMany({
    where: { competitor: { name: "GTreasury" } },
    select: {
      id: true,
      summary: true,
      eventFingerprint: true,
      sourceTitle: true,
      rawContent: true,
      sourceUrl: true,
    },
    orderBy: { detectedAt: "desc" },
  });

  console.log(`\nGTreasury items (${items.length}):\n`);
  for (const i of items) {
    const contentLen = i.rawContent?.length ?? 0;
    const isSnippetOnly = contentLen < 200;
    console.log(`  [${i.eventFingerprint}]`);
    console.log(`  Title: ${i.sourceTitle}`);
    console.log(`  Summary: ${i.summary.slice(0, 100)}`);
    console.log(`  rawContent length: ${contentLen} chars ${isSnippetOnly ? "⚠️ SNIPPET ONLY" : "✅ Full article"}`);
    console.log(`  rawContent preview: ${(i.rawContent ?? "").slice(0, 150).replace(/\n/g, " ")}...`);
    console.log(`  sourceUrl: ${i.sourceUrl}`);
    console.log();
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
