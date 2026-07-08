/**
 * Migration (U7): rename the leftover `finmo_implication` column on
 * `intelligence_items` to the tenant-blind `company_implication`. The Prisma
 * field is already `companyImplication`; only the DB column mapping changed.
 *
 * This repo uses `prisma db push` (not `prisma migrate`), which would DROP+ADD on
 * a @map change and lose data. Run THIS first (a data-preserving ALTER), then
 * `db push` sees the column already matches and makes no change.
 *
 * Idempotent — safe to re-run. Run: npx tsx -r dotenv/config prisma/rename-company-implication-column.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Rename only if the old column still exists and the new one does not.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'intelligence_items' AND column_name = 'finmo_implication'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'intelligence_items' AND column_name = 'company_implication'
      ) THEN
        ALTER TABLE intelligence_items RENAME COLUMN finmo_implication TO company_implication;
        RAISE NOTICE 'Renamed finmo_implication -> company_implication';
      ELSE
        RAISE NOTICE 'No rename needed (already company_implication or column missing)';
      END IF;
    END $$;
  `);

  console.log("Rename migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
