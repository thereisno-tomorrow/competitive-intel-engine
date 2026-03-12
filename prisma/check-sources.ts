import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sources = await prisma.dataSource.findMany({
    include: {
      competitor: { select: { name: true } },
      _count: { select: { intelligenceItems: true } },
    },
  });

  console.log(`\n=== ${sources.length} Data Sources ===\n`);
  for (const s of sources) {
    console.log(`[${s.type}] ${s.competitor.name}`);
    console.log(`  URL: ${s.url}`);
    console.log(`  Health: ${s.health} | Checked: ${s.lastChecked ?? "never"} | Hash: ${s.lastContentHash ? "set" : "none"} | Items: ${s._count.intelligenceItems}`);
    console.log();
  }

  // Intel items summary
  const items = await prisma.intelligenceItem.findMany({
    include: { competitor: { select: { name: true } }, source: { select: { type: true, url: true } } },
    orderBy: { detectedAt: "desc" },
  });
  console.log(`\n=== ${items.length} Intelligence Items ===\n`);
  for (const item of items) {
    console.log(`[${item.type}] ${item.competitor.name} — ${item.summary.slice(0, 80)}`);
    console.log(`  Simulated: ${item.simulated} | Tier: ${item.evidenceTier} | Source: ${item.source?.type ?? "none"}`);
    console.log(`  URL: ${item.sourceUrl}`);
    console.log();
  }

  // Outputs
  const outputs = await prisma.generatedOutput.findMany({
    orderBy: { publishedAt: "desc" },
  });
  console.log(`\n=== ${outputs.length} Generated Outputs ===\n`);
  for (const o of outputs) {
    console.log(`[${o.type}] ${o.headline.slice(0, 80)}`);
    console.log(`  Status: ${o.validationStatus} | Words: ${o.wordCount}`);
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
