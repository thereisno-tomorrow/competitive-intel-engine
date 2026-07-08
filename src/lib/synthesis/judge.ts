import type { LLMProvider } from "@/lib/llm/provider";
import { buildJudgePrompt } from "@/lib/llm/prompts/judge";
import { InfraFault } from "@/lib/errors";

/** A single rubric violation. NO content field — the judge cannot smuggle a rewrite. */
export interface JudgeViolation {
  code: string;
  message: string;
}

export interface JudgeVerdict {
  pass: boolean;
  violations: JudgeViolation[];
}

interface JudgeArgs {
  outputType: string;
  content: unknown;
  rubricText: string;
}

/** Raw shape we accept from the model (extra fields are ignored/stripped). */
interface RawJudgeResponse {
  violations?: unknown;
}

/**
 * Adversarial LLM judge (R4). Runs on the stronger `judge` model, tries to REFUTE
 * the draft, and returns ONLY violations — structurally unable to rewrite content.
 *
 * Fails closed: an unparseable-but-returned verdict → FAIL (never a pass). A
 * broken judge *call* (network / 429 / timeout / malformed JSON from the model)
 * throws InfraFault so the job retries — it is never coerced into a pass.
 *
 * Cost control (KTD5): the CALLER must only invoke this after deterministic
 * validators pass.
 */
export async function judgeOutput(
  llm: LLMProvider,
  args: JudgeArgs,
): Promise<JudgeVerdict> {
  const prompt = buildJudgePrompt(args);

  let raw: RawJudgeResponse;
  try {
    raw = await llm.classifyStructured<RawJudgeResponse>(prompt, { step: "judge" });
  } catch (err) {
    // Broken judge → retryable infra fault. NEVER a pass.
    throw new InfraFault(
      `judge call failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  const violations = normalizeViolations(raw?.violations);
  if (violations === null) {
    // Parseable but ambiguous (no usable violations array) → fail closed.
    return {
      pass: false,
      violations: [
        {
          code: "JUDGE_AMBIGUOUS",
          message: "Judge returned no parseable violations array; failing closed.",
        },
      ],
    };
  }

  return { pass: violations.length === 0, violations };
}

/**
 * Strip the model's response down to `{ code, message }[]`. Returns null when the
 * shape is unusable (→ caller fails closed). This is the runtime guard that drops
 * any smuggled rewrite/content fields.
 */
function normalizeViolations(input: unknown): JudgeViolation[] | null {
  if (!Array.isArray(input)) return null;
  const out: JudgeViolation[] = [];
  for (const v of input) {
    if (v && typeof v === "object" && "code" in v && "message" in v) {
      const code = String((v as Record<string, unknown>).code);
      const message = String((v as Record<string, unknown>).message);
      if (code && message) out.push({ code, message });
    }
  }
  return out;
}
