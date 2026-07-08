import type {
  IntelligenceItem,
  GeneratedOutput,
  PositioningClaim,
  ContentBrief,
  Competitor,
} from "@/generated/prisma/client";
import { COMPANY_STRATEGIC_CONTEXT } from "@/lib/llm/context";
import { COMPANY_NAME } from "@/lib/config/company";
import { CONTENT_STRATEGY_CONTEXT } from "@/lib/llm/context";
import { ClaudeProvider } from "@/lib/llm/claude";

interface BriefSuggestionInput {
  recentIntel: (IntelligenceItem & { competitor: Competitor })[];
  recentOutputs: GeneratedOutput[];
  claims: PositioningClaim[];
  existingBriefs: ContentBrief[];
}

export interface BriefSuggestion {
  title: string;
  angle: string;
  bucket: "INTELLIGENCE_DRIVEN" | "PRODUCT_DRIVEN" | "BUYER_JOURNEY" | "CATEGORY_CREATION";
  funnelStage: "AWARENESS" | "ACQUISITION" | "ACTIVATION" | "RETENTION" | "EXPANSION";
  buyerProblem: string;
  treatments: Array<{
    segment: "STARTUP" | "MSME" | "MID_MARKET";
    headline: string;
    angle: string;
    keyMessages: string[];
    buyerPersona: string;
  }>;
  priorityScore: number;
  priorityRationale: string;
  notes: string;
  sourceId: string | null;
  competitorId: string | null;
}

export async function generateBriefSuggestions(
  input: BriefSuggestionInput
): Promise<BriefSuggestion[]> {
  const claude = new ClaudeProvider();

  const intelSummary = input.recentIntel
    .slice(0, 20)
    .map(
      (item) =>
        `- [${item.competitor.name}] ${item.type}: ${item.summary} (${item.evidenceTier}) | Implication: ${item.companyImplication}`
    )
    .join("\n");

  const outputSummary = input.recentOutputs
    .slice(0, 5)
    .map((out) => {
      const content = out.content as Record<string, unknown>;
      const sections = content?.sections as Record<string, unknown> | undefined;
      const implications = sections?.contentImplications as string[] | undefined;
      const actionItems = sections?.actionItems as string[] | undefined;
      return `- [${out.type}] ${out.headline}${implications ? ` | Content implications: ${implications.join("; ")}` : ""}${actionItems ? ` | Actions: ${actionItems.join("; ")}` : ""}`;
    })
    .join("\n");

  const claimsSummary = input.claims
    .map((c) => `- "${c.claimText}" — Status: ${c.currentStatus}`)
    .join("\n");

  const existingTitles = input.existingBriefs
    .map((b) => `- "${b.title}" (${b.bucket}, ${b.status})`)
    .join("\n");

  const prompt = `You are ${COMPANY_NAME}'s content strategist. Your job is to scan the latest competitive intelligence and generate exactly 5 high-priority content brief suggestions.

${COMPANY_STRATEGIC_CONTEXT}

${CONTENT_STRATEGY_CONTEXT}

RECENT INTELLIGENCE ITEMS:
${intelSummary || "No recent intelligence items."}

RECENT WAR ROOM OUTPUTS (Pulses/Alerts):
${outputSummary || "No recent outputs."}

${COMPANY_NAME.toUpperCase()}'S POSITIONING CLAIMS:
${claimsSummary || "No claims tracked yet."}

EXISTING CONTENT BRIEFS (avoid duplicates):
${existingTitles || "No existing briefs."}

TASK: Generate exactly 5 content brief suggestions. Each must:
1. Be outcome-framed, never feature-led
2. Include 3 segment treatments (STARTUP, MSME, MID_MARKET) with distinct headlines, angles, key messages, and buyer personas
3. Have a priority score (1-100) with rationale
4. Be tagged with the correct content bucket and funnel stage
5. Include strategic notes (AEO potential, dark social potential, LinkedIn format suggestions)
6. Reference the source intelligence item or output ID where applicable
7. NOT duplicate any existing brief titles

ANTI-SAMENESS CHECK: Before finalizing, review each brief. If any brief could appear on a competitor's blog with the company name swapped out, rewrite it to be distinctly ${COMPANY_NAME}. Flag this in the notes.

OUTPUT FORMAT: Respond with ONLY a valid JSON array of 5 objects matching this schema:
[
  {
    "title": string,
    "angle": string,
    "bucket": "INTELLIGENCE_DRIVEN"|"PRODUCT_DRIVEN"|"BUYER_JOURNEY"|"CATEGORY_CREATION",
    "funnelStage": "AWARENESS"|"ACQUISITION"|"ACTIVATION"|"RETENTION"|"EXPANSION",
    "buyerProblem": string,
    "treatments": [
      {
        "segment": "STARTUP"|"MSME"|"MID_MARKET",
        "headline": string,
        "angle": string,
        "keyMessages": string[],
        "buyerPersona": string
      }
    ],
    "priorityScore": number,
    "priorityRationale": string,
    "notes": string,
    "sourceId": string|null,
    "competitorId": string|null
  }
]`;

  return claude.generateStructured<BriefSuggestion[]>(prompt, {});
}
