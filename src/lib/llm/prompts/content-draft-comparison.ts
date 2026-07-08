import type {
  ContentBrief,
  IntelligenceItem,
  Competitor,
  Battlecard,
} from "@/generated/prisma/client";
import {
  COMPANY_STRATEGIC_CONTEXT,
  CONTENT_STRATEGY_CONTEXT,
  WRITING_CRAFT_CONTEXT,
  getCompetitorProfile,
} from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";
import { ClaudeProvider } from "@/lib/llm/claude";

interface ComparisonDraftInput {
  brief: ContentBrief & { competitor: Competitor | null };
  segment: "STARTUP" | "MSME" | "MID_MARKET";
  battlecard: Battlecard | null;
  competitorIntel: (IntelligenceItem & { competitor: Competitor })[];
}

export async function generateComparisonDraft(
  input: ComparisonDraftInput
): Promise<string> {
  const claude = new ClaudeProvider();

  const treatments = input.brief.treatments as Array<{
    segment: string;
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  }>;
  const treatment = treatments.find((t) => t.segment === input.segment);

  const competitorName = input.brief.competitor?.name ?? "Competitor";
  const competitorProfile = input.brief.competitor
    ? getCompetitorProfile(input.brief.competitor.name)
    : "";

  const battlecardContext = input.battlecard
    ? `
BATTLECARD DATA:
- When they come up: ${input.battlecard.whenTheyComeUp}
- Their pitch: ${JSON.stringify(input.battlecard.theirPitch)}
- Weaknesses: ${JSON.stringify(input.battlecard.weaknesses)}
- Why we win: ${JSON.stringify(input.battlecard.whyWeWin ?? [])}
- Why we lose: ${JSON.stringify(input.battlecard.whyWeLose ?? [])}
`
    : "";

  const intelContext = input.competitorIntel
    .slice(0, 10)
    .map(
      (item) =>
        `- ${item.type}: ${item.summary} (${item.evidenceTier}) | ${item.companyImplication}`
    )
    .join("\n");

  const systemPrompt = `You are ${COMPANY_NAME}'s content writer. You follow the Writing Craft Contract with zero exceptions. Violations are failures.

${WRITING_CRAFT_CONTEXT}

REMEMBER: No em dashes. No "it's not X, it's Y" patterns. No filler transitions. No scaffolding announcements. No listicle ghost structure. Vary paragraph rhythm aggressively. Open with substance. Every H2 must be entity-rich and independently citable.`;

  const prompt = `Write a comparison page in markdown: ${COMPANY_NAME} vs ${competitorName}.

${COMPANY_STRATEGIC_CONTEXT}

${CONTENT_STRATEGY_CONTEXT}

${competitorProfile ? `COMPETITOR INTELLIGENCE:\n${competitorProfile}\n` : ""}
${battlecardContext}

CONTENT BRIEF:
- Title: ${input.brief.title}
- Angle: ${input.brief.angle}
- Buyer Problem: ${input.brief.buyerProblem}

SEGMENT TREATMENT (${input.segment}):
- Headline: ${treatment?.headline ?? input.brief.title}
- Angle: ${treatment?.angle ?? input.brief.angle}
- Key Messages: ${treatment?.keyMessages?.join("; ") ?? "N/A"}
- Buyer Persona: ${treatment?.buyerPersona ?? "N/A"}

RECENT INTELLIGENCE ON ${competitorName.toUpperCase()}:
${intelContext || "No recent intelligence."}

TASK: Write a complete comparison page in markdown. Apply all three layers of the
Writing Craft Contract in order: SEO/AEO structure first, then organic architecture,
then sentence-level craft. Self-check against the quality bar before finalizing.

CONTENT RULES:
1. Use the segment treatment headline as the page title (H1)
2. Write for the specific buyer persona in the treatment
3. Structure as a fair comparison. Acknowledge competitor strengths, then reframe using battlecard data
4. Include a comparison table (markdown table) with key dimensions framed as buyer outcomes
5. Every ${COMPANY_NAME} advantage must be framed as a buyer outcome, not a feature
6. Include evidence tiers where making claims about the competitor
7. End with a "Who should choose what" section that is genuinely helpful, not a sales pitch
8. Target 1500-2200 words
9. Never be dismissive or aggressive. Be the confident, knowledgeable advisor.
10. If this could appear on any fintech comparison page with the names swapped out, it fails. Rewrite it.

OUTPUT: Return ONLY the markdown content. No JSON wrapping. Start with # for the title.`;

  const response = await claude.synthesize(prompt, {}, { system: systemPrompt });
  return response;
}
