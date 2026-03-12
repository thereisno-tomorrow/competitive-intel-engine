import type {
  ContentBrief,
  IntelligenceItem,
  Competitor,
} from "@/generated/prisma/client";
import {
  COMPANY_STRATEGIC_CONTEXT,
  CONTENT_STRATEGY_CONTEXT,
  WRITING_CRAFT_CONTEXT,
} from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";
import { ClaudeProvider } from "@/lib/llm/claude";

interface BlogDraftInput {
  brief: ContentBrief & { competitor: Competitor | null };
  segment: "STARTUP" | "MSME" | "MID_MARKET";
  relatedIntel: (IntelligenceItem & { competitor: Competitor })[];
}

export async function generateBlogDraft(input: BlogDraftInput): Promise<string> {
  const claude = new ClaudeProvider();

  const treatments = input.brief.treatments as Array<{
    segment: string;
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  }>;
  const treatment = treatments.find((t) => t.segment === input.segment);

  const intelContext = input.relatedIntel
    .slice(0, 10)
    .map(
      (item) =>
        `- [${item.competitor.name}] ${item.type}: ${item.summary} (${item.evidenceTier})`
    )
    .join("\n");

  const systemPrompt = `You are ${COMPANY_NAME}'s content writer. You follow the Writing Craft Contract with zero exceptions. Violations are failures.

${WRITING_CRAFT_CONTEXT}

REMEMBER: No em dashes. No "it's not X, it's Y" patterns. No filler transitions. No scaffolding announcements. No listicle ghost structure. Vary paragraph rhythm aggressively. Open with substance. Every H2 must be entity-rich and independently citable.`;

  const prompt = `Write a full blog post in markdown.

${COMPANY_STRATEGIC_CONTEXT}

${CONTENT_STRATEGY_CONTEXT}

CONTENT BRIEF:
- Title: ${input.brief.title}
- Angle: ${input.brief.angle}
- Bucket: ${input.brief.bucket}
- Funnel Stage: ${input.brief.funnelStage}
- Buyer Problem: ${input.brief.buyerProblem}
${input.brief.competitor ? `- Related Competitor: ${input.brief.competitor.name}` : ""}

SEGMENT TREATMENT (${input.segment}):
- Headline: ${treatment?.headline ?? input.brief.title}
- Angle: ${treatment?.angle ?? input.brief.angle}
- Key Messages: ${treatment?.keyMessages?.join("; ") ?? "N/A"}
- Buyer Persona: ${treatment?.buyerPersona ?? "N/A"}

SUPPORTING INTELLIGENCE:
${intelContext || "No specific intelligence items."}

STRATEGIC NOTES:
${input.brief.notes ?? "None"}

TASK: Write a complete blog post in markdown. Apply all three layers of the Writing
Craft Contract in order: SEO/AEO structure first, then organic architecture, then
sentence-level craft. Self-check against the quality bar before finalizing.

CONTENT RULES:
1. Use the segment treatment headline as the post title (H1)
2. Write for the specific buyer persona described in the treatment
3. Every claim must be outcome-framed, never feature-led
4. If intelligence-driven, reference competitive context without naming competitors negatively. Reframe as "legacy approaches" or "traditional tools"
5. Target 1200-1800 words
6. If this could appear on any fintech blog with the company name swapped out, it fails. Rewrite it.

OUTPUT: Return ONLY the markdown content. No JSON wrapping. Start with # for the title.`;

  const response = await claude.synthesize(prompt, {}, { system: systemPrompt });
  return response;
}
