import { prisma } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/provider";
import { buildBattlecardSectionPrompt } from "@/lib/llm/prompts/battlecard";
import { loadRubric } from "@/lib/llm/rubric";
import { runTrustPipeline } from "@/lib/synthesis/trust-pipeline";
import { validateLossCondition } from "@/lib/synthesis/validators";
import {
  LIVING_SECTION_KEYS,
  type LivingSectionKey,
} from "@/lib/battlecard/sections";
import { OUTPUT_LIMITS } from "@/lib/config/thresholds";

/** What the section prompt returns: the new content + a "what changed" note. */
interface SectionDraft {
  content: unknown;
  changeSummary: string;
}

export interface SectionResult {
  sectionKey: LivingSectionKey;
  status: "PASSED" | "REGENERATED" | "FLAGGED" | "REJECTED";
  revisionId: string | null;
}

/** Structural + loss-condition validation per section. */
function validateSection(
  sectionKey: LivingSectionKey,
  content: unknown,
): { valid: boolean; errors: string[] } {
  if (!Array.isArray(content)) {
    return { valid: false, errors: [`Section "${sectionKey}" must be an array`] };
  }
  // Loss-condition rule (R7): weaknesses and whyWeLose must carry real substance.
  if (sectionKey === "weaknesses" || sectionKey === "whyWeLose") {
    return validateLossCondition(content);
  }
  return { valid: true, errors: [] };
}

/**
 * Generate/refresh a competitor's living battlecard sections through the Phase 2
 * trust pipeline (validators incl. loss-condition → judge → publish/FLAGGED/reject)
 * and append new revisions with diff + changeSummary + rubricVersion (R7, R10).
 * A REJECTED section never overwrites the current revision.
 */
export async function generateBattlecardSections(
  llm: LLMProvider,
  args: {
    competitorId: string;
    sectionKeys?: readonly LivingSectionKey[];
    reason?: string;
  },
): Promise<SectionResult[]> {
  const sectionKeys = args.sectionKeys ?? LIVING_SECTION_KEYS;

  const competitor = await prisma.competitor.findUnique({
    where: { id: args.competitorId },
  });
  if (!competitor) {
    throw new Error(`Competitor not found: ${args.competitorId}`);
  }

  const [items, claims] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where: { competitorId: competitor.id, simulated: false },
      orderBy: { eventDate: "desc" },
      take: 30,
    }),
    prisma.positioningClaim.findMany(),
  ]);

  const rubric = loadRubric();
  const results: SectionResult[] = [];

  for (const sectionKey of sectionKeys) {
    const section = await prisma.battlecardSection.upsert({
      where: {
        competitorId_sectionKey: { competitorId: competitor.id, sectionKey },
      },
      create: { competitorId: competitor.id, sectionKey },
      update: {},
    });

    const currentRev = await prisma.battlecardSectionRevision.findFirst({
      where: { sectionId: section.id, validationStatus: { in: ["PASSED", "REGENERATED"] } },
      orderBy: { createdAt: "desc" },
    });

    const trust = await runTrustPipeline<SectionDraft>({
      llm,
      maxAttempts: OUTPUT_LIMITS.MAX_REGENERATION_ATTEMPTS,
      outputType: `Battlecard: ${sectionKey}`,
      rubricText: rubric.text,
      buildPrompt: (previousErrors) =>
        buildBattlecardSectionPrompt({
          sectionKey,
          competitorName: competitor.name,
          items,
          claims,
          currentContent: currentRev?.content ?? null,
          rubricText: rubric.text,
          previousErrors,
        }),
      generate: (prompt) => llm.generateStructured<SectionDraft>(prompt, {}),
      validate: (draft) => validateSection(sectionKey, draft.content),
    });

    // A clear fail never overwrites the current revision.
    if (trust.status === "REJECTED" || !trust.content) {
      results.push({ sectionKey, status: "REJECTED", revisionId: null });
      continue;
    }

    const revision = await prisma.battlecardSectionRevision.create({
      data: {
        sectionId: section.id,
        parentRevisionId: currentRev?.id ?? null,
        content: trust.content.content as object,
        diff: {
          before: (currentRev?.content ?? null) as object,
          after: trust.content.content as object,
        },
        changeSummary: trust.content.changeSummary,
        rubricVersion: rubric.version,
        validationStatus: trust.status,
      },
    });

    results.push({ sectionKey, status: trust.status, revisionId: revision.id });
  }

  return results;
}
