/**
 * A pipeline step whose model is selected independently via env config.
 *
 * - `draft`    — output/battlecard drafting (cheap model by default: DeepSeek)
 * - `judge`    — adversarial quality gate (stronger model)
 * - `classify` — "is this noteworthy?" ingestion decision (stronger model)
 */
export type LLMStep = "draft" | "judge" | "classify";

export interface LLMCallOptions {
  /** Reduce max_tokens for cheaper/shorter calls. */
  fast?: boolean;
  /** Override which model step this call routes to. Defaults per method. */
  step?: LLMStep;
}

export interface LLMProvider {
  classifyStructured<T>(prompt: string, options?: LLMCallOptions): Promise<T>;
  generateStructured<T>(
    prompt: string,
    context: Record<string, unknown>,
    options?: LLMCallOptions,
  ): Promise<T>;
}
