/**
 * One-time migration (U15): seed revision 1 for each living battlecard section from
 * the existing hand-written cards, so quality is preserved and the first
 * auto-revision diffs against a real baseline. Append-only: originals are never
 * overwritten. Idempotent — a section that already has a revision is skipped.
 *
 * Repo rule: test on a small sample first.
 *   npx tsx -r dotenv/config prisma/migrate-cards-to-revisions.ts --limit 5   # sample
 *   npx tsx -r dotenv/config prisma/migrate-cards-to-revisions.ts             # full run
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  LIVING_SECTION_KEYS,
  extractBaselineContent,
} from "../src/lib/battlecard/sections";
import { loadRubric } from "../src/lib/llm/rubric";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;

  let rubricVersion: string | null = null;
  try {
    rubricVersion = loadRubric().version;
  } catch {
    console.warn("Rubric not found — seeding revision 1 with null rubricVersion.");
  }

  const competitors = await prisma.competitor.findMany({
    where: { battlecard: { isNot: null } },
    include: { battlecard: true, reframes: true },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Migrating ${competitors.length} competitor card(s)…`);
  let sectionsCreated = 0;
  let sectionsSkipped = 0;

  for (const competitor of competitors) {
    const card = competitor.battlecard;
    if (!card) continue;
    const baseline = extractBaselineContent(card, competitor.reframes);

    for (const key of LIVING_SECTION_KEYS) {
      const section = await prisma.battlecardSection.upsert({
        where: { competitorId_sectionKey: { competitorId: competitor.id, sectionKey: key } },
        create: { competitorId: competitor.id, sectionKey: key },
        update: {},
        include: { revisions: { take: 1 } },
      });

      if (section.revisions.length > 0) {
        sectionsSkipped++;
        continue;
      }

      await prisma.battlecardSectionRevision.create({
        data: {
          sectionId: section.id,
          parentRevisionId: null,
          content: baseline[key] as object,
          changeSummary: "Curated baseline (revision 1)",
          rubricVersion,
          validationStatus: "PASSED",
        },
      });
      sectionsCreated++;
    }
    console.log(`  ${competitor.name}: baseline seeded`);
  }

  console.log(`Done. ${sectionsCreated} revision-1 created, ${sectionsSkipped} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
