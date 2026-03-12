import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear GeneratedOutput first (has many-to-many with IntelligenceItem)
  const outputs = await prisma.generatedOutput.deleteMany();
  const intel = await prisma.intelligenceItem.deleteMany();
  const seen = await prisma.seenArticle.deleteMany();
  console.log(`Deleted ${outputs.count} GeneratedOutputs (pulses/alerts)`);
  console.log(`Deleted ${intel.count} IntelligenceItems`);
  console.log(`Deleted ${seen.count} SeenArticles`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
