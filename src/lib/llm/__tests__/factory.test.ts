import { describe, expect, it, vi } from "vitest";
import {
  buildModelConfig,
  FactoryProvider,
  routesToOpenRouter,
  type ModelConfig,
} from "../factory";
import { OpenRouterClient } from "../openrouter";
import { LLMParseError } from "../json";

/** A recording client that captures which model it was asked to complete. */
function recorder(response: string) {
  const calls: { model: string; prompt: string; maxTokens: number }[] = [];
  return {
    calls,
    complete: vi.fn(async (model: string, prompt: string, maxTokens: number) => {
      calls.push({ model, prompt, maxTokens });
      return response;
    }),
  };
}

const CONFIG: ModelConfig = {
  draft: "deepseek/deepseek-chat",
  judge: "claude-sonnet-4-5-20250929",
  classify: "anthropic/claude-3.5-sonnet",
};

describe("buildModelConfig", () => {
  it("reads per-step env vars", () => {
    const config = buildModelConfig({
      LLM_MODEL_DRAFT: "deepseek/foo",
      LLM_MODEL_JUDGE: "claude-judge",
      LLM_MODEL_CLASSIFY: "claude-classify",
    } as unknown as NodeJS.ProcessEnv);
    expect(config.draft).toBe("deepseek/foo");
    expect(config.judge).toBe("claude-judge");
    expect(config.classify).toBe("claude-classify");
  });

  it("falls back to defaults when env is unset", () => {
    const config = buildModelConfig({} as unknown as NodeJS.ProcessEnv);
    expect(config.draft).toBe("deepseek/deepseek-chat");
  });
});

describe("routesToOpenRouter", () => {
  it("routes slugs with a slash to OpenRouter", () => {
    expect(routesToOpenRouter("deepseek/deepseek-chat")).toBe(true);
    expect(routesToOpenRouter("anthropic/claude-3.5-sonnet")).toBe(true);
  });
  it("routes bare ids to Anthropic", () => {
    expect(routesToOpenRouter("claude-sonnet-4-5-20250929")).toBe(false);
  });
});

describe("FactoryProvider routing", () => {
  it("routes a draft call to the draft model via OpenRouter", async () => {
    const openrouter = recorder('{"ok":true}');
    const anthropic = recorder("{}");
    const provider = new FactoryProvider(CONFIG, {
      openrouter: openrouter as unknown as OpenRouterClient,
      anthropic: anthropic as unknown as never,
    });

    await provider.generateStructured("draft this", {});
    expect(openrouter.calls[0]?.model).toBe("deepseek/deepseek-chat");
    expect(anthropic.calls).toHaveLength(0);
  });

  it("routes a judge step to the judge model, not the draft model", async () => {
    const openrouter = recorder("{}");
    const anthropic = recorder('{"ok":true}');
    const provider = new FactoryProvider(CONFIG, {
      openrouter: openrouter as unknown as OpenRouterClient,
      anthropic: anthropic as unknown as never,
    });

    await provider.generateStructured("judge this", {}, { step: "judge" });
    // judge model is a bare id → Anthropic client
    expect(anthropic.calls[0]?.model).toBe("claude-sonnet-4-5-20250929");
    expect(openrouter.calls).toHaveLength(0);
  });

  it("strips markdown-fenced JSON and parses it", async () => {
    const openrouter = recorder("```json\n{\"value\": 42}\n```");
    const provider = new FactoryProvider(CONFIG, {
      openrouter: openrouter as unknown as OpenRouterClient,
      anthropic: recorder("{}") as unknown as never,
    });
    const result = await provider.generateStructured<{ value: number }>("x", {});
    expect(result.value).toBe(42);
  });

  it("throws a typed parse error on malformed JSON", async () => {
    const openrouter = recorder("not json at all");
    const provider = new FactoryProvider(CONFIG, {
      openrouter: openrouter as unknown as OpenRouterClient,
      anthropic: recorder("{}") as unknown as never,
    });
    await expect(provider.generateStructured("x", {})).rejects.toBeInstanceOf(
      LLMParseError,
    );
  });
});

describe("OpenRouterClient missing key", () => {
  it("throws a clear error naming OPENROUTER_API_KEY", async () => {
    const client = new OpenRouterClient(undefined);
    await expect(client.complete("deepseek/deepseek-chat", "hi", 100)).rejects.toThrow(
      /OPENROUTER_API_KEY/,
    );
  });
});
