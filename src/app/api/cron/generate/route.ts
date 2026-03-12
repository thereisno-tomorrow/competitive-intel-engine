import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAlertThreshold } from "@/lib/synthesis/alert-evaluator";
import { generateSignalAlert } from "@/lib/generators/signal-alert";
import { generateWeeklyPulse } from "@/lib/generators/weekly-pulse";
import { generateMonthlyPulse } from "@/lib/generators/monthly-pulse";
import { ClaudeProvider } from "@/lib/llm/claude";
import { SCHEDULE } from "@/lib/config/thresholds";
import { validateCronSecret } from "@/lib/auth";

/** Get current date in SGT (UTC+8) */
function getSGTDate(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + SCHEDULE.SGT_OFFSET_HOURS * 3600_000);
}

/** Check if an output of this type was already generated today (SGT) */
async function alreadyGeneratedToday(
  type: "WEEKLY_PULSE" | "MONTHLY_PULSE",
): Promise<boolean> {
  const sgtNow = getSGTDate();
  const startOfDay = new Date(sgtNow);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(sgtNow);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await prisma.generatedOutput.findFirst({
    where: {
      type,
      publishedAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  return existing !== null;
}

interface GenerateResult {
  signalAlerts: Array<{ id: string; headline: string; deduplicated: boolean }>;
  weeklyPulse: { id: string; headline: string } | null;
  monthlyPulse: { id: string; headline: string } | null;
}

const MAX_SIGNAL_ALERTS_PER_RUN = 20;

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const llm = new ClaudeProvider();
  const forceGenerate = url.searchParams.get("force") === "true";
  const pulseOnly = url.searchParams.get("pulseOnly") === "true";
  const result: GenerateResult = {
    signalAlerts: [],
    weeklyPulse: null,
    monthlyPulse: null,
  };

  // 1. Pulses — run weekly + monthly in parallel
  const sgtNow = getSGTDate();
  const dayOfWeek = sgtNow.getDay();
  const dayOfMonth = sgtNow.getDate();

  const shouldWeekly = forceGenerate || dayOfWeek === SCHEDULE.WEEKLY_PULSE_DAY;
  const shouldMonthly = forceGenerate || (dayOfMonth >= 1 && dayOfMonth <= SCHEDULE.MONTHLY_PULSE_MAX_BUSINESS_DAY);

  // Pre-check dedup in parallel
  const [weeklyDone, monthlyDone] = await Promise.all([
    shouldWeekly && !forceGenerate ? alreadyGeneratedToday("WEEKLY_PULSE") : false,
    shouldMonthly && !forceGenerate ? alreadyGeneratedToday("MONTHLY_PULSE") : false,
  ]);

  // Fire both pulse generations in parallel
  const pulsePromises: Promise<void>[] = [];

  if (shouldWeekly && !weeklyDone) {
    pulsePromises.push(
      generateWeeklyPulse(llm).then((weekly) => {
        result.weeklyPulse = { id: weekly.id, headline: weekly.headline };
      }),
    );
  }

  if (shouldMonthly && !monthlyDone) {
    pulsePromises.push(
      generateMonthlyPulse(llm).then((monthly) => {
        result.monthlyPulse = { id: monthly.id, headline: monthly.headline };
      }),
    );
  }

  await Promise.all(pulsePromises);

  // 2. Signal alerts — batched parallel (ALERT_CONCURRENCY at a time)
  const ALERT_CONCURRENCY = 5;

  if (!pulseOnly) {
    const unprocessedItems = await prisma.intelligenceItem.findMany({
      where: { alertTriggered: false },
      include: { competitor: true, claimsAffected: true },
      orderBy: { detectedAt: "desc" },
      take: MAX_SIGNAL_ALERTS_PER_RUN,
    });

    // Evaluate thresholds synchronously (no LLM, instant)
    const itemsToProcess = unprocessedItems.map((item) => ({
      item,
      evaluation: evaluateAlertThreshold({
        competitorTier: item.competitor.tier,
        intelType: item.type,
        content: item.rawContent,
        affectsPositioningClaims: item.claimsAffected.length > 0,
      }),
    }));

    // Process in batches of ALERT_CONCURRENCY
    for (let i = 0; i < itemsToProcess.length; i += ALERT_CONCURRENCY) {
      const batch = itemsToProcess.slice(i, i + ALERT_CONCURRENCY);

      await Promise.all(
        batch.map(async ({ item, evaluation }) => {
          if (evaluation.shouldAlert) {
            try {
              const alert = await generateSignalAlert(llm, item.id, evaluation.reasons);
              result.signalAlerts.push({
                id: alert.id,
                headline: alert.headline,
                deduplicated: alert.deduplicated,
              });
              await prisma.intelligenceItem.update({
                where: { id: item.id },
                data: { alertTriggered: true },
              });
            } catch (e) {
              // Leave alertTriggered: false so item gets retried next run
              console.error(`Signal alert failed for ${item.id}:`, e instanceof Error ? e.message : e);
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
  }

  return NextResponse.json({ success: true, ...result });
}
