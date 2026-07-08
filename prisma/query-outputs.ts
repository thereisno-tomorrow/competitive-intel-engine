import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const outputs = await prisma.generatedOutput.findMany({
    select: {
      id: true,
      type: true,
      headline: true,
      publishedAt: true,
      validationStatus: true,
      wordCount: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  for (const o of outputs) {
    console.log("---");
    console.log(`type: ${o.type} | status: ${o.validationStatus}`);
    console.log(`headline: ${o.headline}`);
    console.log(`publishedAt: ${o.publishedAt.toISOString()} | words: ${o.wordCount}`);
  }
  console.log("---");
  console.log(`Total outputs: ${outputs.length}`);

  // Also check latest pulse content keys
  const latest = await prisma.generatedOutput.findFirst({
    where: {
      type: { in: ["WEEKLY_PULSE", "MONTHLY_PULSE"] },
      validationStatus: { in: ["PASSED", "REGENERATED"] },
    },
    orderBy: { publishedAt: "desc" },
  });

  if (latest) {
    console.log("\n=== LATEST PULSE ===");
    console.log(`type: ${latest.type}`);
    console.log(`headline: ${latest.headline}`);
    const content = latest.content as Record<string, unknown> | null;
    if (content?.sections) {
      console.log("sections keys:", Object.keys(content.sections));
      for (const [key, val] of Object.entries(content.sections)) {
        if (Array.isArray(val)) {
          console.log(`  ${key}: ${val.length} items`);
        } else if (typeof val === "string") {
          console.log(`  ${key}: "${(val as string).slice(0, 80)}..."`);
        } else {
          console.log(`  ${key}: ${typeof val}`);
        }
      }
    }
  } else {
    console.log("\n=== NO VALID PULSE FOUND ===");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
