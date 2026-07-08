import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import { buildSignalAlertPrompt } from "@/lib/llm/prompts/signal-alert";
import { loadRubric } from "@/lib/llm/rubric";
import { validateSignalAlert } from "@/lib/synthesis/validators";
import { runTrustPipeline } from "@/lib/synthesis/trust-pipeline";
import { OUTPUT_LIMITS } from "@/lib/config/thresholds";
import type { SignalAlertContent } from "@/types";

interface GenerationResult {
  id: string;
  headline: string;
  content: SignalAlertContent;
  wordCount: number;
  validationStatus: "PASSED" | "REJECTED" | "REGENERATED" | "FLAGGED";
  deduplicated: boolean;
}

export async function generateSignalAlert(
  llm: LLMProvider,
  itemId: string,
  alertReasons: string[],
): Promise<GenerationResult> {
  // Fetch the triggering intelligence item
  const item = await prisma.intelligenceItem.findUnique({
    where: { id: itemId },
    include: { competitor: true },
  });

  if (!item) {
    throw new Error(`Intelligence item not found: ${itemId}`);
  }

  // Deduplication: check if an alert already exists for this item
  const existingAlerts = await prisma.generatedOutput.findMany({
    where: {
      type: "SIGNAL_ALERT",
      intelligenceItems: { some: { id: itemId } },
    },
  });

  if (existingAlerts.length > 0) {
    const existing = existingAlerts[0]!;
    return {
      id: existing.id,
      headline: existing.headline,
      // Prisma Json field → typed content; structure validated at generation time
      content: existing.content as unknown as SignalAlertContent,
      wordCount: existing.wordCount,
      // Prisma ValidationStatus enum is structurally compatible with our union
      validationStatus: existing.validationStatus as GenerationResult["validationStatus"],
      deduplicated: true,
    };
  }

  // Fetch positioning claims for context
  const claims = await prisma.positioningClaim.findMany();

  const rubric = loadRubric();

  const trust = await runTrustPipeline<SignalAlertContent>({
    llm,
    maxAttempts: OUTPUT_LIMITS.MAX_REGENERATION_ATTEMPTS,
    outputType: "Signal Alert",
    rubricText: rubric.text,
    buildPrompt: (previousErrors) =>
      buildSignalAlertPrompt({
        item,
        claims,
        alertReasons,
        rubricText: rubric.text,
        previousErrors,
      }),
    generate: (prompt) => llm.generateStructured<SignalAlertContent>(prompt, {}),
    validate: (c) => validateSignalAlert(c, OUTPUT_LIMITS.SIGNAL_ALERT_MAX_WORDS),
  });

  const content = trust.content;
  const validationStatus = trust.status;
  const attempts = trust.attempts;

  if (validationStatus === "REJECTED") {
    console.error(`Signal alert rejected after ${attempts} attempts:`, trust.errors);
  }

  if (!content) throw new Error("Failed to generate signal alert content");

  const headline = `${item.competitor.name}: ${content.sections.whatHappened.slice(0, 80)}`;

  const contentJson = JSON.stringify(content);
  const wordCount = contentJson.split(/\s+/).length;

  const now = new Date();

  const output = await prisma.generatedOutput.create({
    data: {
      type: "SIGNAL_ALERT",
      eventDate: item.eventDate,
      headline,
      content: JSON.parse(contentJson),
      wordCount,
      validationStatus,
      rubricVersion: rubric.version,
      judgeVerdict: trust.judgeVerdict ? JSON.parse(JSON.stringify(trust.judgeVerdict)) : undefined,
      generationMetadata: {
        attempts,
        generatedAt: now.toISOString(),
        alertReasons,
        triggeringItemId: itemId,
      },
      intelligenceItems: {
        connect: [{ id: itemId }],
      },
    },
  });

  return {
    id: output.id,
    headline,
    content,
    wordCount,
    validationStatus,
    deduplicated: false,
  };
}
