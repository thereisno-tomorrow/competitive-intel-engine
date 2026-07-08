import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import { buildWeeklyPulsePrompt } from "@/lib/llm/prompts/weekly-pulse";
import { loadRubric } from "@/lib/llm/rubric";
import { validateWeeklyPulse, validateTierMonotonicity } from "@/lib/synthesis/validators";
import { runTrustPipeline } from "@/lib/synthesis/trust-pipeline";
import { OUTPUT_LIMITS } from "@/lib/config/thresholds";
import type { WeeklyPulseContent } from "@/types";

interface GenerationResult {
  id: string;
  headline: string;
  content: WeeklyPulseContent;
  wordCount: number;
  validationStatus: "PASSED" | "REJECTED" | "REGENERATED" | "FLAGGED";
}

export async function generateWeeklyPulse(
  llm: LLMProvider,
): Promise<GenerationResult> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [items, claims] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where: {
        eventDate: { gte: weekStart },
        simulated: false
      },
      include: { competitor: true },
      orderBy: { eventDate: "desc" },
    }),
    prisma.positioningClaim.findMany(),
  ]);

  const rubric = loadRubric();
  const weekStartStr = weekStart.toISOString().split("T")[0] ?? "";
  const weekEndStr = now.toISOString().split("T")[0] ?? "";

  // Two-gate trust pipeline: validators → adversarial judge → publish/retry (U9/U10).
  const trust = await runTrustPipeline<WeeklyPulseContent>({
    llm,
    maxAttempts: OUTPUT_LIMITS.MAX_REGENERATION_ATTEMPTS,
    outputType: "Weekly Pulse",
    rubricText: rubric.text,
    buildPrompt: (previousErrors) =>
      buildWeeklyPulsePrompt({
        claims,
        items,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        rubricText: rubric.text,
        previousErrors,
      }),
    generate: (prompt) => llm.generateStructured<WeeklyPulseContent>(prompt, {}),
    validate: (c) => {
      const base = validateWeeklyPulse(c, OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS);
      // Tier monotonicity (U12): no signal may out-claim its cited sources.
      const asserted = (c.sections?.topSignals ?? []).map((s) => s.evidenceTier);
      const mono = validateTierMonotonicity(
        asserted,
        items.map((i) => i.evidenceTier),
      );
      return {
        valid: base.valid && mono.valid,
        errors: [...base.errors, ...mono.errors],
      };
    },
  });

  const content = trust.content;
  const validationStatus = trust.status;
  const attempts = trust.attempts;

  if (validationStatus === "REJECTED") {
    console.error(`Weekly pulse rejected after ${attempts} attempts:`, trust.errors);
  }

  if (!content) throw new Error("Failed to generate weekly pulse content");

  const headline = content.sections.actionRequired
    ? `Action Required: ${content.sections.actionRequired.slice(0, 80)}`
    : items.length === 0
      ? "Nothing Notable This Week"
      : `${items.length} signal${items.length !== 1 ? "s" : ""} detected this week`;

  const contentJson = JSON.stringify(content);
  const wordCount = contentJson.split(/\s+/).length;

  const output = await prisma.generatedOutput.create({
    data: {
      type: "WEEKLY_PULSE",
      headline,
      content: JSON.parse(contentJson),
      wordCount,
      validationStatus,
      rubricVersion: rubric.version,
      judgeVerdict: trust.judgeVerdict ? JSON.parse(JSON.stringify(trust.judgeVerdict)) : undefined,
      generationMetadata: { attempts, generatedAt: now.toISOString() },
      intelligenceItems: {
        connect: items.map((item) => ({ id: item.id })),
      },
    },
  });

  return { id: output.id, headline, content, wordCount, validationStatus };
}
