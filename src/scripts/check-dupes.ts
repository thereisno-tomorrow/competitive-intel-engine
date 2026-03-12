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
      detectedAt: true,
      sourceTitle: true,
    },
    orderBy: { detectedAt: "desc" },
  });

  console.log(`\nGTreasury items (${items.length}):\n`);
  for (const i of items) {
    console.log(`  [${i.eventFingerprint}]`);
    console.log(`  ${i.summary.slice(0, 100)}`);
    console.log(`  detected: ${i.detectedAt.toISOString()}\n`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
