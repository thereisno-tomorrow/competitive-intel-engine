import type { LLMProvider } from "@/lib/llm/provider";
import { judgeOutput, type JudgeVerdict } from "./judge";

export type TrustStatus = "PASSED" | "REGENERATED" | "REJECTED" | "FLAGGED";

export interface TrustResult<T> {
  content: T | null;
  status: TrustStatus;
  attempts: number;
  judgeVerdict: JudgeVerdict | null;
  errors: string[];
}

export interface TrustPipelineOptions<T> {
  llm: LLMProvider;
  maxAttempts: number;
  /** Human label for the artifact (e.g. "Weekly Pulse"). */
  outputType: string;
  /** Owner-editable rubric text (U8) handed to the judge. */
  rubricText: string;
  /** Build the draft prompt; receives the previous attempt's failure reasons (U9). */
  buildPrompt: (previousErrors: string[] | undefined) => string;
  /** Produce a draft from a prompt. */
  generate: (prompt: string) => Promise<T>;
  /** Deterministic validators (cheap first gate, KTD5). */
  validate: (content: T) => { valid: boolean; errors: string[] };
}

/**
 * The two-gate trust pipeline (KTD5): draft → deterministic validators → (only if
 * they pass) adversarial judge → publish or retry-with-feedback. The judge runs
 * on the stronger model and can only refute, never rewrite. A judge *call* failure
 * throws InfraFault out of here so the worker job retries — never a silent pass.
 *
 * Status semantics for U10: judge clean pass → PASSED/REGENERATED; all attempts
 * exhausted → REJECTED. The FLAGGED "close call" outcome is layered on in U13.
 */
export async function runTrustPipeline<T>(
  opts: TrustPipelineOptions<T>,
): Promise<TrustResult<T>> {
  let content: T | null = null;
  let attempts = 0;
  let lastErrors: string[] = [];
  let judgeVerdict: JudgeVerdict | null = null;

  while (attempts < opts.maxAttempts) {
    attempts++;
    const prompt = opts.buildPrompt(attempts > 1 ? lastErrors : undefined);
    content = await opts.generate(prompt);

    // Gate 1 — deterministic validators.
    const validation = opts.validate(content);
    if (!validation.valid) {
      lastErrors = validation.errors;
      continue;
    }

    // Gate 2 — adversarial judge (only after validators pass; cost control).
    judgeVerdict = await judgeOutput(opts.llm, {
      outputType: opts.outputType,
      content,
      rubricText: opts.rubricText,
    });

    if (judgeVerdict.pass) {
      return {
        content,
        status: attempts > 1 ? "REGENERATED" : "PASSED",
        attempts,
        judgeVerdict,
        errors: [],
      };
    }

    // Judge failed → feed its specific violations back into the next attempt (U9).
    lastErrors = judgeVerdict.violations.map((v) => `${v.code}: ${v.message}`);
  }

  return {
    content,
    status: "REJECTED",
    attempts,
    judgeVerdict,
    errors: lastErrors,
  };
}
