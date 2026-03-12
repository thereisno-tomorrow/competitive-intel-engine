import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Delete all generated outputs (alerts + rejected pulses)
  const deleted = await prisma.generatedOutput.deleteMany();
  console.log(`Deleted ${deleted.count} generated outputs`);

  // Reset alertTriggered on all intel items so they get re-evaluated
  const reset = await prisma.intelligenceItem.updateMany({
    where: { alertTriggered: true },
    data: { alertTriggered: false },
  });
  console.log(`Reset alertTriggered on ${reset.count} items`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
