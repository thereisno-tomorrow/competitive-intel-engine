/**
 * Migration: Backfill eventFingerprint for all existing intelligence items.
 *
 * Generates a deterministic fingerprint from each item's summary and writes
 * it to the new eventFingerprint column. Safe to re-run (idempotent).
 *
 * Run: npx tsx -r dotenv/config prisma/backfill-fingerprints.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateEventFingerprint } from "../src/lib/ingestion/event-fingerprint";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const items = await prisma.intelligenceItem.findMany({
    select: { id: true, summary: true, eventFingerprint: true },
  });

  console.log(`Found ${items.length} intelligence items`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const fingerprint = generateEventFingerprint(undefined, item.summary);

    if (item.eventFingerprint === fingerprint) {
      skipped++;
      continue;
    }

    await prisma.intelligenceItem.update({
      where: { id: item.id },
      data: { eventFingerprint: fingerprint },
    });
    updated++;
  }

  console.log(`Done: ${updated} updated, ${skipped} already correct`);

  // Show fingerprint distribution
  const groups = await prisma.$queryRawUnsafe<
    { fingerprint: string; count: bigint }[]
  >(
    `SELECT event_fingerprint as fingerprint, COUNT(*) as count
     FROM intelligence_items
     WHERE event_fingerprint IS NOT NULL
     GROUP BY event_fingerprint
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT 20`,
  );

  if (groups.length > 0) {
    console.log(`\nDuplicate fingerprint groups (top 20):`);
    for (const g of groups) {
      console.log(`  ${g.fingerprint}: ${g.count} items`);
    }
  } else {
    console.log(`\nNo duplicate fingerprints found`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
