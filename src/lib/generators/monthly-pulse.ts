import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import { buildMonthlyPulsePrompt } from "@/lib/llm/prompts/monthly-pulse";
import { loadRubric } from "@/lib/llm/rubric";
import { validateMonthlyPulse } from "@/lib/synthesis/validators";
import { OUTPUT_LIMITS } from "@/lib/config/thresholds";
import type { MonthlyPulseContent } from "@/types";

interface GenerationResult {
  id: string;
  headline: string;
  content: MonthlyPulseContent;
  wordCount: number;
  validationStatus: "PASSED" | "REJECTED" | "REGENERATED" | "FLAGGED";
}

export async function generateMonthlyPulse(
  llm: LLMProvider,
): Promise<GenerationResult> {
  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);

  const [items, claims] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where: {
        eventDate: { gte: monthStart },
        simulated: false
      },
      include: { competitor: true },
      orderBy: { eventDate: "desc" },
    }),
    prisma.positioningClaim.findMany(),
  ]);

  const rubric = loadRubric();
  const monthStartStr = monthStart.toISOString().split("T")[0] ?? "";
  const monthEndStr = now.toISOString().split("T")[0] ?? "";

  let content: MonthlyPulseContent | null = null;
  let validationStatus: GenerationResult["validationStatus"] = "REJECTED";
  let attempts = 0;
  let lastErrors: string[] = [];

  while (attempts < OUTPUT_LIMITS.MAX_REGENERATION_ATTEMPTS) {
    attempts++;
    // Retry carries the previous attempt's specific failure reasons (U9).
    const prompt = buildMonthlyPulsePrompt({
      claims,
      items,
      monthStart: monthStartStr,
      monthEnd: monthEndStr,
      rubricText: rubric.text,
      previousErrors: attempts > 1 ? lastErrors : undefined,
    });
    content = await llm.generateStructured<MonthlyPulseContent>(prompt, {});

    const validation = validateMonthlyPulse(
      content,
      OUTPUT_LIMITS.MONTHLY_PULSE_MAX_WORDS,
    );
    if (validation.valid) {
      validationStatus = attempts > 1 ? "REGENERATED" : "PASSED";
      break;
    }
    lastErrors = validation.errors;
  }

  if (validationStatus === "REJECTED") {
    console.error(`Monthly pulse rejected after ${attempts} attempts:`, lastErrors);
  }

  if (!content) throw new Error("Failed to generate monthly pulse content");

  const claimsUnderPressure = content.sections.positioningConfidence.filter(
    (c) => c.status === "UNDER_PRESSURE" || c.status === "CONTESTED",
  );

  const headline =
    items.length === 0
      ? "Quiet Month — No Significant Competitive Activity"
      : claimsUnderPressure.length > 0
        ? `${claimsUnderPressure.length} positioning claim${claimsUnderPressure.length !== 1 ? "s" : ""} under pressure — ${items.length} signals this month`
        : `${items.length} signal${items.length !== 1 ? "s" : ""} tracked this month — positioning stable`;

  const contentJson = JSON.stringify(content);
  const wordCount = contentJson.split(/\s+/).length;

  const output = await prisma.generatedOutput.create({
    data: {
      type: "MONTHLY_PULSE",
      headline,
      content: JSON.parse(contentJson),
      wordCount,
      validationStatus,
      rubricVersion: rubric.version,
      generationMetadata: { attempts, generatedAt: now.toISOString() },
      intelligenceItems: {
        connect: items.map((item) => ({ id: item.id })),
      },
    },
  });

  return { id: output.id, headline, content, wordCount, validationStatus };
}
