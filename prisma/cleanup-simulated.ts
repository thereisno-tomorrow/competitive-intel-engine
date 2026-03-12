import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Delete all simulated intelligence items
  const deletedItems = await prisma.intelligenceItem.deleteMany({
    where: { simulated: true },
  });
  console.log(`Deleted ${deletedItems.count} simulated intelligence items`);

  // 2. Delete seeded GeneratedOutputs (pulses/alerts) that reference simulated items
  //    These were created by seed-pulses.ts and link to simulated items.
  //    After deleting simulated items, orphaned outputs have no real backing data.
  //    Identify them: any output whose ALL linked items are gone (no items left).
  const outputs = await prisma.generatedOutput.findMany({
    include: { intelligenceItems: { select: { id: true } } },
  });

  const orphanedIds = outputs
    .filter((o) => o.intelligenceItems.length === 0)
    .map((o) => o.id);

  if (orphanedIds.length > 0) {
    const deletedOutputs = await prisma.generatedOutput.deleteMany({
      where: { id: { in: orphanedIds } },
    });
    console.log(`Deleted ${deletedOutputs.count} orphaned generated outputs (seeded pulses/alerts)`);
  } else {
    console.log("No orphaned generated outputs found");
  }

  // 3. Summary
  const remainingItems = await prisma.intelligenceItem.count();
  const remainingOutputs = await prisma.generatedOutput.count();
  console.log(`\nRemaining: ${remainingItems} real intel items, ${remainingOutputs} generated outputs`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
