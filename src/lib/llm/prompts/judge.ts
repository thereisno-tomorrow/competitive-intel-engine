import { COMPANY_NAME } from "@/lib/config/company";

interface JudgePromptArgs {
  /** Human label for the artifact under review (e.g. "Weekly Pulse"). */
  outputType: string;
  /** The generated content to refute (JSON-serializable). */
  content: unknown;
  /** The owner-editable rubric text (U8) — the quality bar to judge against. */
  rubricText: string;
}

/**
 * Adversarial judge prompt: the judge's job is to REFUTE the draft against the
 * rubric, not to improve it. It returns ONLY a list of violations — it has no
 * channel to rewrite content (that structural constraint is the point).
 */
export function buildJudgePrompt(args: JudgePromptArgs): string {
  return `You are an adversarial quality judge for ${COMPANY_NAME}'s competitive intelligence outputs.

Your ONLY job is to try to REFUTE the draft below against the rubric. You do NOT rewrite, improve, or rephrase it. You look for concrete rubric violations and report them.

Be strict. Default to failing: if you are unsure whether something meets the bar, treat it as a violation. A clean pass means you tried hard to break it and could not.

THE RUBRIC (judge against Part A — the universal analytical standards):
${args.rubricText}

THE DRAFT UNDER REVIEW (${args.outputType}):
${JSON.stringify(args.content, null, 2)}

Check especially:
- Swap test (R2): would any load-bearing sentence survive swapping the competitor's name for another? If so, it's generic mush — a violation.
- Mechanism over adjective (R3): are weaknesses structural causes, or bare adjectives?
- Grounded assertions (R4): does every claim carry an honest tier and cite a source that supports the specific claim? No claim may out-claim its evidence tier.
- Genuine concessions (R5): where a strength exists, is it conceded plainly?
- Honest loss conditions (R11): does it admit where ${COMPANY_NAME} loses, or is it all "we win"?

OUTPUT FORMAT: Respond with ONLY valid JSON of this exact shape. "violations" are blocking (any → FAIL); "warnings" are non-blocking soft concerns that don't fail the draft but merit a human glance (they route the output to a review queue). Empty violations = pass. Do NOT include any rewritten content, suggestions, or fixed text; report violations/warnings only:
{
  "violations": [
    { "code": "SHORT_UPPER_SNAKE_CODE", "message": "one concrete sentence naming the specific problem" }
  ],
  "warnings": [
    { "code": "SHORT_UPPER_SNAKE_CODE", "message": "a borderline concern worth a human glance, but not disqualifying" }
  ]
}`;
}
