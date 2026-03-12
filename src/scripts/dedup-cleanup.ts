/**
 * One-time cleanup: identify and remove duplicate IntelligenceItems.
 *
 * Strategy:
 * 1. Group items by competitor
 * 2. For each competitor, cluster items by exact OR fuzzy eventFingerprint match
 * 3. Within each cluster, keep the best item (CONFIRMED > INFERRED > UNKNOWN, then earliest)
 * 4. Delete the rest
 *
 * Run:
 *   DRY_RUN=true npx tsx -r dotenv/config src/scripts/dedup-cleanup.ts   # preview
 *   npx tsx -r dotenv/config src/scripts/dedup-cleanup.ts                 # execute
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fuzzyFingerprintMatch } from "../lib/ingestion/event-fingerprint";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.env.DRY_RUN === "true";

const TIER_ORDER: Record<string, number> = {
  CONFIRMED: 0,
  INFERRED: 1,
  UNKNOWN: 2,
};

async function main() {
  console.log(`\n=== Dedup Cleanup (${DRY_RUN ? "DRY RUN" : "LIVE"}) ===\n`);

  const competitors = await prisma.competitor.findMany({
    select: { id: true, name: true },
  });

  let totalClusters = 0;
  let totalDupes = 0;
  let totalDeleted = 0;

  for (const comp of competitors) {
    const items = await prisma.intelligenceItem.findMany({
      where: {
        competitorId: comp.id,
        eventFingerprint: { not: null },
      },
      select: {
        id: true,
        eventFingerprint: true,
        summary: true,
        detectedAt: true,
        evidenceTier: true,
        sourceTitle: true,
      },
      orderBy: { detectedAt: "asc" },
    });

    // Cluster by exact or fuzzy fingerprint match
    const clustered = new Set<string>();
    const clusters: (typeof items)[] = [];

    for (let i = 0; i < items.length; i++) {
      if (clustered.has(items[i]!.id)) continue;
      const cluster = [items[i]!];
      clustered.add(items[i]!.id);

      for (let j = i + 1; j < items.length; j++) {
        if (clustered.has(items[j]!.id)) continue;
        const fp1 = items[i]!.eventFingerprint!;
        const fp2 = items[j]!.eventFingerprint!;
        if (fp1 === fp2 || fuzzyFingerprintMatch(fp1, fp2)) {
          cluster.push(items[j]!);
          clustered.add(items[j]!.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    if (clusters.length === 0) continue;

    console.log(`${comp.name}: ${clusters.length} duplicate cluster(s)`);
    totalClusters += clusters.length;

    for (const cluster of clusters) {
      // Pick the best: prefer CONFIRMED tier, then earliest detectedAt
      cluster.sort((a, b) => {
        const tierDiff =
          (TIER_ORDER[a.evidenceTier] ?? 2) - (TIER_ORDER[b.evidenceTier] ?? 2);
        if (tierDiff !== 0) return tierDiff;
        return a.detectedAt.getTime() - b.detectedAt.getTime();
      });

      const keeper = cluster[0]!;
      const dupes = cluster.slice(1);
      totalDupes += dupes.length;

      console.log(
        `  KEEP: [${keeper.eventFingerprint}] "${keeper.summary.slice(0, 70)}..." (${keeper.evidenceTier})`,
      );
      for (const dupe of dupes) {
        console.log(
          `  DEL:  [${dupe.eventFingerprint}] "${dupe.summary.slice(0, 70)}..." (${dupe.evidenceTier})`,
        );
      }

      if (!DRY_RUN) {
        const dupeIds = dupes.map((d) => d.id);
        await prisma.intelligenceItem.deleteMany({
          where: { id: { in: dupeIds } },
        });
        totalDeleted += dupeIds.length;
      }
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Clusters found: ${totalClusters}`);
  console.log(`Duplicates identified: ${totalDupes}`);
  console.log(
    `${DRY_RUN ? "Would delete" : "Deleted"}: ${DRY_RUN ? totalDupes : totalDeleted}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
