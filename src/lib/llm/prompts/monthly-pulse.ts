import type { IntelligenceItem, PositioningClaim, Competitor } from "@/generated/prisma/client";
import { COMPANY_STRATEGIC_CONTEXT, COMPANY_EXTENDED_CONTEXT, getAllCompetitorProfiles, SYNTHESIS_RUBRIC, INTELLIGENCE_LAYER_RUBRIC } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";

interface MonthlyPulsePromptContext {
  claims: PositioningClaim[];
  items: (IntelligenceItem & { competitor: Competitor })[];
  monthStart: string;
  monthEnd: string;
}

export function buildMonthlyPulsePrompt(ctx: MonthlyPulsePromptContext): string {
  const claimsList = ctx.claims
    .map((c, i) => `${i + 1}. [${c.id}] "${c.claimText}" — Current status: ${c.currentStatus}`)
    .join("\n");

  const tier1Items = ctx.items.filter((item) => item.competitor.tier === "TIER_1");
  const tier2Items = ctx.items.filter((item) => item.competitor.tier === "TIER_2");

  const formatItem = (item: IntelligenceItem & { competitor: Competitor }): string =>
    `- [${item.competitor.name}] ${item.summary} (${item.evidenceTier}, ${item.type})${item.simulated ? " [SIMULATED]" : ""}`;

  const tier1Section = tier1Items.length === 0
    ? "No Tier 1 competitor activity this month."
    : tier1Items.map(formatItem).join("\n");

  const tier2Section = tier2Items.length === 0
    ? "No Tier 2 competitor activity this month."
    : tier2Items.map(formatItem).join("\n");

  return `You are ${COMPANY_NAME}'s competitive intelligence analyst, writing the CMO's monthly strategic briefing. This is the most important CI output — it shapes positioning decisions, content strategy, and board-level narratives.

${COMPANY_STRATEGIC_CONTEXT}

COMPETITIVE LANDSCAPE (threat models for all tracked competitors):
${getAllCompetitorProfiles()}

${SYNTHESIS_RUBRIC}

${COMPANY_EXTENDED_CONTEXT}

${INTELLIGENCE_LAYER_RUBRIC}

${COMPANY_NAME.toUpperCase()}'S THREE POSITIONING CLAIMS (current status):
${claimsList}

TIER 1 COMPETITOR INTELLIGENCE (${ctx.monthStart} to ${ctx.monthEnd}):
${tier1Section}

TIER 2 COMPETITOR INTELLIGENCE (${ctx.monthStart} to ${ctx.monthEnd}):
${tier2Section}

TOTAL ITEMS: ${ctx.items.length} (Tier 1: ${tier1Items.length}, Tier 2: ${tier2Items.length})

TASK: Generate a Monthly Pulse briefing for the CMO.

INTELLIGENCE LAYER REQUIREMENTS:
1. THREAT STATUS: For each Tier 1 competitor, assess threat status: DORMANT | EMERGING | ACTIVE | CRITICAL
2. CROSS-COMPETITOR PATTERNS: If 2+ competitors converge on same capability/language, flag category shift
3. TEMPORAL VELOCITY: Note any competitor acceleration/deceleration vs prior month
4. KNOWN UNKNOWNS: Identify top 3 intelligence gaps by (threat severity × confidence gap)
5. OFFENSIVE OPPORTUNITIES: For each threat, identify the weakness it exposes

Every section should reference specific evidence with counts: "3 hiring signals," "2 blog posts," "0 case studies."

RULES:
- Max 1000 words total
- Category health: Is your category narrative gaining traction? Are competitors converging on ${COMPANY_NAME}'s quadrant or staying in their lanes?
- For Tier 1 competitors: identify narrative shifts — are they changing positioning, messaging, or strategy? Use the competitor profiles above to assess what these shifts mean for ${COMPANY_NAME} specifically.
- For Tier 2 competitors: flag watch items only — brief signals worth monitoring
- For each positioning claim: assess confidence with evidence counts (for and against). Use the threat models above to determine whether evidence supports or undermines each claim.
- Include 2-3 actionable content implications — specific enough for a Head of Content Strategy to act on this week. BAD: "Create competitive content." GOOD: "Publish a 'payments platform vs. treasury operating system' comparison piece before Airwallex announces treasury features."
- Every signal must carry its evidence tier (CONFIRMED, INFERRED, or UNKNOWN)
- Focus on "so what" — why it matters for ${COMPANY_NAME} specifically, not just what happened
- Items marked [SIMULATED] should still be analyzed but noted as simulated
- If a quiet month: say so clearly. Do NOT generate filler analysis. Stability is a finding.
- Be opinionated. Strategic clarity over comprehensive coverage. The CMO asks "how do we know?" — answer that question.

OUTPUT FORMAT: Respond with ONLY valid JSON matching this exact schema:
{
  "sections": {
    "categoryHealth": string,
    "tier1Shifts": [{
      "competitor": string,
      "narrative": string,
      "evidenceTier": "CONFIRMED"|"INFERRED"|"UNKNOWN",
      "threatStatus": "DORMANT"|"EMERGING"|"ACTIVE"|"CRITICAL",
      "velocity": "ACCELERATING"|"STABLE"|"DECELERATING"|"UNKNOWN",
      "offensiveOpportunity": string | null
    }],
    "tier2Watch": [{ "competitor": string, "signal": string }],
    "positioningConfidence": [{
      "claimId": string,
      "claimText": string,
      "status": "HOLDING"|"UNDER_PRESSURE"|"CONTESTED",
      "evidenceForCount": number,
      "evidenceAgainstCount": number,
      "assessment": string
    }],
    "contentImplications": string[],
    "crossCompetitorPatterns": [{
      "pattern": string,
      "competitors": string[],
      "implication": string,
      "urgency": "HIGH"|"MEDIUM"|"LOW"
    }],
    "knownUnknowns": [{
      "question": string,
      "whyItMatters": string,
      "recommendedAction": string
    }],
    "threatStatusSummary": {
      "critical": string[],
      "active": string[],
      "emerging": string[],
      "dormant": string[]
    }
  }
}`;
}
