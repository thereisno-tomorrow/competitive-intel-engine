import "dotenv/config";

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;
if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set");
  process.exit(1);
}

process.env.DATABASE_URL = vercelDbUrl;

async function main() {
  const { prisma } = await import("../src/lib/db");

  const pulses = await prisma.generatedOutput.findMany({
    where: {
      type: { in: ["WEEKLY_PULSE", "MONTHLY_PULSE"] },
    },
    select: {
      type: true,
      headline: true,
      validationStatus: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  console.log("\nPulses in production database:\n");
  console.table(pulses);

  await prisma.$disconnect();
}

main();
