import type { IntelligenceItem, PositioningClaim } from "@/generated/prisma/client";
import { COMPANY_STRATEGIC_CONTEXT, getCompetitorProfile } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";
import { buildRetryFeedbackBlock } from "./weekly-pulse";
import type { LivingSectionKey } from "@/lib/battlecard/sections";

interface BattlecardSectionPromptContext {
  sectionKey: LivingSectionKey;
  competitorName: string;
  items: IntelligenceItem[];
  claims: PositioningClaim[];
  currentContent: unknown;
  rubricText: string;
  previousErrors?: string[];
}

/** Per-section output schema description shown to the model. */
const SECTION_SCHEMA: Record<LivingSectionKey, string> = {
  weaknesses:
    'Array<{ "text": string (a STRUCTURAL weakness — mechanism, not adjective), "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN", "sourceUrl": string }>',
  reframes:
    'Array<{ "weakness": string, "reframe": string (a literal discovery question a rep can ask, not naming the competitor), "antiReframe": string (the tempting overclaim, why it backfires, and the defensible line), "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN" }>',
  whyWeLose:
    'Array<{ "point": string (an honest deal shape where the competitor genuinely wins), "context": string, "action": string (the redirect or qualify-out), "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN" }>',
  openQuestions: "Array<string> (decision-relevant intelligence gaps — each a checkable fact)",
};

const SECTION_GUIDANCE: Record<LivingSectionKey, string> = {
  weaknesses:
    "Every weakness must pass the swap test and name a structural cause the competitor cannot cheaply fix. No bare adjectives.",
  reframes:
    "Each reframe must be question-led, acknowledge-and-redirect (never deny a CONFIRMED strength), land on the buyer's job, and be speakable in ~30 seconds.",
  whyWeLose:
    "Be honest. State at least one real deal shape where the competitor wins, each with the rep's redirect. A section that says we always win is a failure.",
  openQuestions:
    "Each question names a checkable fact and implies what would change on the card if answered. No rhetorical questions.",
};

/**
 * Build a rubric-grounded prompt to (re)generate a single living battlecard
 * section from the competitor's stored intelligence, diffing against the current
 * revision. Returns the section content plus a "what changed" note.
 */
export function buildBattlecardSectionPrompt(
  ctx: BattlecardSectionPromptContext,
): string {
  const profile = getCompetitorProfile(ctx.competitorName);
  const itemsList =
    ctx.items.length === 0
      ? "No recent intelligence items."
      : ctx.items
          .map(
            (i) =>
              `- ${i.type}: ${i.summary} (${i.evidenceTier}) | ${i.companyImplication} | ${i.sourceUrl}`,
          )
          .join("\n");
  const feedbackBlock = buildRetryFeedbackBlock(ctx.previousErrors);

  return `You are ${COMPANY_NAME}'s competitive strategist maintaining the "${ctx.sectionKey}" section of the ${ctx.competitorName} battlecard.
${feedbackBlock}
${COMPANY_STRATEGIC_CONTEXT}

COMPETITOR:
${profile}

GTM ANALYSIS STANDARDS (the quality bar — apply Part A and the battlecard criteria):
${ctx.rubricText}

RECENT INTELLIGENCE ON ${ctx.competitorName.toUpperCase()}:
${itemsList}

CURRENT "${ctx.sectionKey}" SECTION (revise it; keep what still holds, update what the intelligence changes):
${JSON.stringify(ctx.currentContent ?? [], null, 2)}

SECTION GUIDANCE: ${SECTION_GUIDANCE[ctx.sectionKey]}

TASK: Produce the updated "${ctx.sectionKey}" section grounded in the intelligence above. Respond with ONLY valid JSON:
{
  "content": ${SECTION_SCHEMA[ctx.sectionKey]},
  "changeSummary": string (one sentence: what changed vs the current section, and why — the material signal that drove it)
}`;
}
