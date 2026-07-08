import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.intelligenceItem.findMany({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    include: { competitor: { select: { name: true } } },
  });
  console.log(`\n=== ${recent.length} intel items created in last hour ===\n`);
  for (const item of recent) {
    console.log(`[${item.competitor.name}] ${item.type} | ${item.evidenceTier}`);
    console.log(`  ${item.summary.slice(0, 120)}`);
    console.log(`  src: ${item.sourceUrl}`);
    console.log();
  }

  const totals = await prisma.intelligenceItem.groupBy({
    by: ["simulated"],
    _count: true,
  });
  console.log("Totals by simulated flag:");
  for (const t of totals) {
    console.log(`  simulated=${t.simulated}: ${t._count}`);
  }

  const lastOutputs = await prisma.generatedOutput.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { type: true, createdAt: true, validationStatus: true, headline: true },
  });
  console.log("\nLast 5 generated outputs:");
  for (const o of lastOutputs) {
    console.log(`  ${o.createdAt.toISOString()} | ${o.type} | ${o.validationStatus} | ${o.headline.slice(0, 80)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
