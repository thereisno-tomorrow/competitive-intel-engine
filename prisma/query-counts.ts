import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const real = await prisma.intelligenceItem.count({ where: { simulated: false } });
  const simulated = await prisma.intelligenceItem.count({ where: { simulated: true } });
  const outputs = await prisma.generatedOutput.count();
  console.log(`Real intel items: ${real}`);
  console.log(`Simulated intel items: ${simulated}`);
  console.log(`Generated outputs (pulses/alerts): ${outputs}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
