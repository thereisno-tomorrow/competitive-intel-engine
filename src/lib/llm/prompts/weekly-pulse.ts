import type { IntelligenceItem, PositioningClaim, Competitor } from "@/generated/prisma/client";
import { COMPANY_STRATEGIC_CONTEXT, COMPANY_EXTENDED_CONTEXT, SYNTHESIS_RUBRIC, INTELLIGENCE_LAYER_RUBRIC } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";

interface WeeklyPulsePromptContext {
  claims: PositioningClaim[];
  items: (IntelligenceItem & { competitor: Competitor })[];
  weekStart: string;
  weekEnd: string;
  /** Owner-editable strategy/rubric text (U8), injected as the quality bar. */
  rubricText?: string;
}

export function buildWeeklyPulsePrompt(ctx: WeeklyPulsePromptContext): string {
  const claimsList = ctx.claims
    .map((c, i) => `${i + 1}. "${c.claimText}" — Current status: ${c.currentStatus}`)
    .join("\n");

  const itemsList = ctx.items.length === 0
    ? "No intelligence items detected this week."
    : ctx.items
        .map((item) =>
          `- [${item.competitor.name}] ${item.summary} (${item.evidenceTier}, ${item.type})${item.simulated ? " [SIMULATED]" : ""}`
        )
        .join("\n");

  const rubricBlock = ctx.rubricText
    ? `\nGTM ANALYSIS STANDARDS (the quality bar — apply Part A to this pulse):\n${ctx.rubricText}\n`
    : "";

  return `You are ${COMPANY_NAME}'s competitive intelligence analyst, writing the CMO's Monday morning briefing.

${COMPANY_STRATEGIC_CONTEXT}
${rubricBlock}

${SYNTHESIS_RUBRIC}

${COMPANY_EXTENDED_CONTEXT}

${INTELLIGENCE_LAYER_RUBRIC}

${COMPANY_NAME.toUpperCase()}'S THREE POSITIONING CLAIMS (current status):
${claimsList}

INTELLIGENCE ITEMS THIS WEEK (${ctx.weekStart} to ${ctx.weekEnd}):
${itemsList}

TASK: Generate a Weekly Pulse briefing for the CMO. This is her Monday morning check — 3 minutes, then she closes the tab. Make every word count.

INTELLIGENCE LAYER ANALYSIS:
This week's signals should be analyzed through these additional lenses:
1. TEMPORAL: Are any competitors showing velocity changes (acceleration/deceleration)?
2. PATTERNS: Do this week's signals connect to patterns from prior weeks?
3. OFFENSIVE: What competitor weaknesses do this week's moves expose?
4. GAPS: What should we be seeing but aren't?

Focus on "so what" — if temporal/pattern/offensive analysis doesn't change the recommendation, omit it.

RULES:
- Under 500 words total
- If no notable items: output "Nothing notable this week" with a calm outlook. Do NOT generate filler. Quiet is a signal — it means positioning is stable.
- Every signal must reference at least one positioning claim it affects
- Every signal must carry its evidence tier (CONFIRMED, INFERRED, or UNKNOWN)
- Focus on "so what" — why it matters for ${COMPANY_NAME} specifically, not just what happened
- Items marked [SIMULATED] should still be analyzed but noted as simulated
- Be opinionated. If something doesn't matter, exclude it. The CMO values editorial judgment about what to OMIT.
- Write as if briefing a CMO who asks "how do we know?" for every claim.

OUTPUT FORMAT: Respond with ONLY valid JSON matching this exact schema:
{
  "sections": {
    "topSignals": [{
      "competitor": string,
      "summary": string,
      "implication": string,
      "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN",
      "sourceUrl": string,
      "temporalContext": string | null
    }],
    "claimStatuses": [{
      "claimId": string,
      "claimText": string,
      "status": "HOLDING"|"UNDER_PRESSURE"|"CONTESTED",
      "changeFromLastWeek": "improved"|"unchanged"|"degraded"
    }],
    "actionRequired": string | null,
    "outlook": string,
    "offensiveOpportunities": [{
      "competitor": string,
      "theirMove": string,
      "exposedWeakness": string,
      "companyOpportunity": string
    }]
  }
}`;
}
