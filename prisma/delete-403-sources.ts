import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BAD_IDS = [
  "cmmdej5zr0000qwectnnehlvp",
  "cmmdej62q0004qweceygkbexf",
  "cmmdej64z0008qwecoaszukst",
  "cmmdej67e000cqwec1u7jxvyo",
  "cmmdej69w000gqwecdzhlyqe5",
  "cmmdej6c9000kqwecggfugzx3",
];

async function main() {
  const sources = await prisma.dataSource.findMany({
    where: { id: { in: BAD_IDS } },
    include: { competitor: { select: { name: true } } },
  });

  console.log(`Found ${sources.length} sources to delete:`);
  sources.forEach((s) => console.log(`  ${s.competitor.name} | ${s.type} | ${s.url}`));

  await prisma.seenArticle.deleteMany({ where: { sourceId: { in: BAD_IDS } } });
  const result = await prisma.dataSource.deleteMany({ where: { id: { in: BAD_IDS } } });
  console.log(`\nDeleted ${result.count} sources`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
