import {
  LLM_MAX_TOKENS,
  LLM_MODEL_DEFAULTS,
  LLM_MODEL_ENV,
} from "@/lib/config/thresholds";
import { AnthropicClient } from "./claude";
import { parseStructured } from "./json";
import { OpenRouterClient } from "./openrouter";
import type { LLMCallOptions, LLMProvider, LLMStep } from "./provider";

const JSON_INSTRUCTION =
  "IMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation.";

/** Resolved model id per step. */
export type ModelConfig = Record<LLMStep, string>;

/** Build the per-step model config from env, falling back to defaults. */
export function buildModelConfig(
  env: NodeJS.ProcessEnv = process.env,
): ModelConfig {
  const steps: LLMStep[] = ["draft", "judge", "classify"];
  const config = {} as ModelConfig;
  for (const step of steps) {
    const fromEnv = env[LLM_MODEL_ENV[step]]?.trim();
    config[step] = fromEnv && fromEnv.length > 0 ? fromEnv : LLM_MODEL_DEFAULTS[step];
  }
  return config;
}

/** A model id containing "/" is an OpenRouter slug; a bare id routes to Anthropic. */
export function routesToOpenRouter(model: string): boolean {
  return model.includes("/");
}

interface Clients {
  openrouter: OpenRouterClient;
  anthropic: AnthropicClient;
}

/**
 * LLMProvider that selects a model per step from config and routes to the
 * matching client. JSON parsing is centralized (fence-stripping + typed error).
 */
export class FactoryProvider implements LLMProvider {
  constructor(
    private readonly config: ModelConfig,
    private readonly clients: Clients,
  ) {}

  private async complete(
    step: LLMStep,
    prompt: string,
    maxTokens: number,
  ): Promise<string> {
    const model = this.config[step];
    if (routesToOpenRouter(model)) {
      return this.clients.openrouter.complete(model, prompt, maxTokens);
    }
    return this.clients.anthropic.complete(model, prompt, maxTokens);
  }

  async classifyStructured<T>(
    prompt: string,
    options?: LLMCallOptions,
  ): Promise<T> {
    const step = options?.step ?? "classify";
    const text = await this.complete(
      step,
      `${prompt}\n\n${JSON_INSTRUCTION}`,
      LLM_MAX_TOKENS.classify,
    );
    return parseStructured<T>(text);
  }

  async generateStructured<T>(
    prompt: string,
    context: Record<string, unknown>,
    options?: LLMCallOptions,
  ): Promise<T> {
    const step = options?.step ?? "draft";
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
    const maxTokens =
      step === "draft"
        ? options?.fast
          ? LLM_MAX_TOKENS.draftFast
          : LLM_MAX_TOKENS.draft
        : LLM_MAX_TOKENS[step];
    const text = await this.complete(
      step,
      `${prompt}\n\nContext:\n${contextStr}\n\n${JSON_INSTRUCTION}`,
      maxTokens,
    );
    return parseStructured<T>(text);
  }
}

/**
 * Construct the default provider from env. Clients are created eagerly but do
 * not require keys at construction time — a missing key throws a clear error
 * only when a call actually routes to that client.
 */
export function createLLMProvider(
  env: NodeJS.ProcessEnv = process.env,
): LLMProvider {
  const config = buildModelConfig(env);
  return new FactoryProvider(config, {
    openrouter: new OpenRouterClient(env.OPENROUTER_API_KEY),
    anthropic: new AnthropicClient(),
  });
}
