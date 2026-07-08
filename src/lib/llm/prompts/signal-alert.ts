import type { IntelligenceItem, PositioningClaim, Competitor } from "@/generated/prisma/client";
import { COMPANY_STRATEGIC_CONTEXT, COMPANY_EXTENDED_CONTEXT, getCompetitorProfile, SYNTHESIS_RUBRIC, INTELLIGENCE_LAYER_RUBRIC } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";
import { buildRetryFeedbackBlock } from "./weekly-pulse";

interface SignalAlertPromptContext {
  item: IntelligenceItem & { competitor: Competitor };
  claims: PositioningClaim[];
  alertReasons: string[];
  /** Owner-editable strategy/rubric text (U8), injected as the quality bar. */
  rubricText?: string;
  /** Specific validator failure reasons from the previous attempt (U9). */
  previousErrors?: string[];
}

export function buildSignalAlertPrompt(ctx: SignalAlertPromptContext): string {
  const { item } = ctx;
  const rubricBlock = ctx.rubricText
    ? `\nGTM ANALYSIS STANDARDS (the quality bar — apply Part A to this alert):\n${ctx.rubricText}\n`
    : "";
  const feedbackBlock = buildRetryFeedbackBlock(ctx.previousErrors);

  const claimsList = ctx.claims
    .map((c, i) => `${i + 1}. [${c.id}] "${c.claimText}" — Current status: ${c.currentStatus}`)
    .join("\n");

  const alertReasonsList = ctx.alertReasons
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  const competitorProfile = getCompetitorProfile(item.competitor.name);

  return `You are ${COMPANY_NAME}'s competitive intelligence analyst, briefing the CMO on a significant competitive event.
${feedbackBlock}
${COMPANY_STRATEGIC_CONTEXT}
${rubricBlock}
COMPETITOR CONTEXT:
${competitorProfile}

${SYNTHESIS_RUBRIC}

${COMPANY_EXTENDED_CONTEXT}

${INTELLIGENCE_LAYER_RUBRIC}

TRIGGERING EVENT:
- Competitor: ${item.competitor.name} (${item.competitor.tier})
- Type: ${item.type}
- Summary: ${item.summary}
- Evidence Tier: ${item.evidenceTier}
- Source URL: ${item.sourceUrl ?? "N/A"}
- Detected: ${item.detectedAt.toISOString()}
- Company Implication: ${item.companyImplication ?? "Not yet assessed"}
${item.simulated ? "- STATUS: [SIMULATED DATA]\n" : ""}
RAW CONTENT:
${item.rawContent ?? "No raw content available."}

ALERT TRIGGERED BECAUSE:
${alertReasonsList}

${COMPANY_NAME.toUpperCase()}'S THREE POSITIONING CLAIMS:
${claimsList}

TASK: Generate a Signal Alert for the CMO about this specific event.

INTELLIGENCE LAYER DEPTH:
- TEMPORAL: Is this part of an acceleration pattern? How many similar signals in last 60/90 days?
- STRATEGIC INTENT: WHY is the competitor doing this?
- LEAD vs LAG: Is this predictive (3-6mo lead time) or confirmatory?
- OFFENSIVE ANGLE: What weakness does their move expose? How can ${COMPANY_NAME} exploit it?
- CONFIDENCE EVOLUTION: How does this signal change evidence tier for related threats? ([U] → [I] → [C])

If none of these lenses add actionable insight, omit them. Analysis must drive decisions.

RULES:
- Be factual about what happened, opinionated about why it matters
- Clearly state the evidence tier of the triggering event
- Identify which of ${COMPANY_NAME}'s positioning claims are affected (by claim ID)
- Provide a specific recommended response — not generic advice
- Action items should be concrete and assignable
- Include source URLs where available
- If the item is simulated, note this clearly but still provide full analysis
- Focus on "so what" for ${COMPANY_NAME} — this is intelligence, not information

OUTPUT FORMAT: Respond with ONLY valid JSON matching this exact schema:
{
  "sections": {
    "whatHappened": string,
    "whyItMatters": string,
    "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN",
    "claimsAffected": string[],
    "recommendedResponse": string,
    "actionItems": string[],
    "sourceUrls": string[],
    "temporalContext": {
      "signalType": "LEAD"|"LAG"|"UNKNOWN",
      "priorSignalsLast60Days": number,
      "velocity": "ACCELERATING"|"STABLE"|"FIRST_SIGNAL",
      "confidenceEvolution": string | null
    },
    "strategicContext": {
      "moveType": "POSITIONING"|"PRODUCT"|"GTM",
      "inferredIntent": string,
      "segment": "ENTERPRISE"|"MID_MARKET"|"MSME"|"STARTUP"|"ALL",
      "offensiveOpportunity": string | null
    }
  }
}`;
}
