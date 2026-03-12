import "dotenv/config";
import { prisma } from "../lib/db";
import { ClaudeProvider } from "../lib/llm/claude";
import { generateWeeklyPulse } from "../lib/generators/weekly-pulse";
import { generateMonthlyPulse } from "../lib/generators/monthly-pulse";
import { generateSignalAlert } from "../lib/generators/signal-alert";
import { evaluateAlertThreshold } from "../lib/synthesis/alert-evaluator";

const ALERT_CONCURRENCY = 5;
const MAX_ALERTS = 20;

async function main() {
  const args = process.argv.slice(2);
  const pulseOnly = args.includes("--pulse-only");
  const weeklyOnly = args.includes("--weekly");
  const monthlyOnly = args.includes("--monthly");
  const alertsOnly = args.includes("--alerts");

  const llm = new ClaudeProvider();
  const start = Date.now();

  // Pulses
  if (!alertsOnly) {
    const pulsePromises: Promise<void>[] = [];

    if (!monthlyOnly) {
      pulsePromises.push(
        generateWeeklyPulse(llm).then((r) => {
          console.log(`Weekly pulse: ${r.headline} [${r.validationStatus}]`);
        }),
      );
    }

    if (!weeklyOnly) {
      pulsePromises.push(
        generateMonthlyPulse(llm).then((r) => {
          console.log(`Monthly pulse: ${r.headline} [${r.validationStatus}]`);
        }),
      );
    }

    await Promise.all(pulsePromises);
  }

  // Signal alerts (always run unless --pulse-only)
  if (!pulseOnly) {
    const unprocessed = await prisma.intelligenceItem.findMany({
      where: { alertTriggered: false },
      include: { competitor: true, claimsAffected: true },
      orderBy: { detectedAt: "desc" },
      take: MAX_ALERTS,
    });

    console.log(`\n${unprocessed.length} unprocessed items for alert evaluation`);

    const items = unprocessed.map((item) => ({
      item,
      evaluation: evaluateAlertThreshold({
        competitorTier: item.competitor.tier,
        intelType: item.type,
        content: item.rawContent,
        affectsPositioningClaims: item.claimsAffected.length > 0,
      }),
    }));

    let alertCount = 0;

    for (let i = 0; i < items.length; i += ALERT_CONCURRENCY) {
      const batch = items.slice(i, i + ALERT_CONCURRENCY);

      await Promise.all(
        batch.map(async ({ item, evaluation }) => {
          if (evaluation.shouldAlert) {
            try {
              const alert = await generateSignalAlert(llm, item.id, evaluation.reasons);
              alertCount++;
              console.log(`  Alert ${alertCount}: ${alert.headline}${alert.deduplicated ? " [DEDUP]" : ""}`);
              await prisma.intelligenceItem.update({
                where: { id: item.id },
                data: { alertTriggered: true },
              });
            } catch (e) {
              // Leave alertTriggered: false so item gets retried next run
              console.error(`  Alert failed for ${item.id}:`, e instanceof Error ? e.message : e);
            }
          } else {
            // Didn't meet threshold — mark as processed
            await prisma.intelligenceItem.update({
              where: { id: item.id },
              data: { alertTriggered: true },
            });
          }
        }),
      );
    }

    console.log(`${alertCount} signal alerts generated`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
