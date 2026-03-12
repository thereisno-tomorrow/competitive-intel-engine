import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import { buildWeeklyPulsePrompt } from "@/lib/llm/prompts/weekly-pulse";
import { validateWeeklyPulse } from "@/lib/synthesis/validators";
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

  const prompt = buildWeeklyPulsePrompt({
    claims,
    items,
    weekStart: weekStart.toISOString().split("T")[0] ?? "",
    weekEnd: now.toISOString().split("T")[0] ?? "",
  });

  let content: WeeklyPulseContent | null = null;
  let validationStatus: GenerationResult["validationStatus"] = "REJECTED";
  let attempts = 0;
  let lastErrors: string[] = [];

  while (attempts < OUTPUT_LIMITS.MAX_REGENERATION_ATTEMPTS) {
    attempts++;
    content = await llm.generateStructured<WeeklyPulseContent>(prompt, {});

    const validation = validateWeeklyPulse(
      content,
      OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS,
    );
    if (validation.valid) {
      validationStatus = attempts > 1 ? "REGENERATED" : "PASSED";
      break;
    }
    lastErrors = validation.errors;
  }

  if (validationStatus === "REJECTED") {
    console.error(`Weekly pulse rejected after ${attempts} attempts:`, lastErrors);
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
      generationMetadata: { attempts, generatedAt: now.toISOString() },
      intelligenceItems: {
        connect: items.map((item) => ({ id: item.id })),
      },
    },
  });

  return { id: output.id, headline, content, wordCount, validationStatus };
}
