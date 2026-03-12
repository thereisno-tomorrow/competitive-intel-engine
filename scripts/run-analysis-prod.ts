import "dotenv/config";

// This script runs pulse + signal generation locally against production database

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;

if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set in .env");
  process.exit(1);
}

// Temporarily override DATABASE_URL
const originalDbUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = vercelDbUrl;

console.log("🧠 Running competitive analysis (pulse + signals)...\n");

async function main() {
  // Import after setting DATABASE_URL
  const { generateWeeklyPulse } = await import("../src/lib/generators/weekly-pulse");
  const { generateMonthlyPulse } = await import("../src/lib/generators/monthly-pulse");
  const { generateSignalAlert } = await import("../src/lib/generators/signal-alert");
  const { evaluateAlertThreshold } = await import("../src/lib/synthesis/alert-evaluator");
  const { ClaudeProvider } = await import("../src/lib/llm/claude");
  const { prisma } = await import("../src/lib/db");

  const llm = new ClaudeProvider();

  try {
    // Generate weekly pulse
    console.log("📊 Generating weekly pulse...");
    const weekly = await generateWeeklyPulse(llm);
    console.log(`✅ Weekly pulse: ${weekly.headline}`);

    // Generate monthly pulse
    console.log("\n📊 Generating monthly pulse...");
    const monthly = await generateMonthlyPulse(llm);
    console.log(`✅ Monthly pulse: ${monthly.headline}`);

    // Generate signal alerts for unprocessed items
    console.log("\n🚨 Generating signal alerts...");
    const unprocessedItems = await prisma.intelligenceItem.findMany({
      where: { alertTriggered: false },
      include: { competitor: true, claimsAffected: true },
      orderBy: { detectedAt: "desc" },
      take: 20,
    });

    console.log(`   Found ${unprocessedItems.length} unprocessed items`);

    let alertCount = 0;
    for (const item of unprocessedItems) {
      const evaluation = evaluateAlertThreshold({
        competitorTier: item.competitor.tier,
        intelType: item.type,
        content: item.rawContent,
        affectsPositioningClaims: item.claimsAffected.length > 0,
      });

      if (evaluation.shouldAlert) {
        const alert = await generateSignalAlert(llm, item.id, evaluation.reasons);
        console.log(`   ✅ ${alert.headline}`);
        alertCount++;
      }

      await prisma.intelligenceItem.update({
        where: { id: item.id },
        data: { alertTriggered: true },
      });
    }

    console.log(`\n✅ Generated ${alertCount} signal alerts`);
    console.log("\n🚀 Check your site to see the new insights!");
  } catch (err) {
    console.error("\n❌ Analysis failed:", err);
    process.exit(1);
  } finally {
    process.env.DATABASE_URL = originalDbUrl;
  }
}

main();
