import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import type { LLMProvider } from "./provider";

const SONNET_MODEL = "claude-sonnet-4-5-20250929";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** Extract text from the first content block, returning fallback if absent. */
function extractText(content: ContentBlock[], fallback: string = ""): string {
  const block = content[0];
  if (block && block.type === "text") {
    return block.text;
  }
  return fallback;
}

/** Strip markdown code fences that LLMs sometimes wrap around JSON output. */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async synthesize(
    prompt: string,
    context: Record<string, unknown>,
    options?: { system?: string },
  ): Promise<string> {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");

    const response = await this.client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 8192,
      ...(options?.system ? { system: options.system } : {}),
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nContext:\n${contextStr}`,
        },
      ],
    });

    return extractText(response.content);
  }

  async classifyStructured<T>(prompt: string): Promise<T> {
    const response = await this.client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation.`,
        },
      ],
    });

    const text = extractText(response.content, "{}");
    return JSON.parse(stripFences(text)) as T;
  }

  async generateStructured<T>(prompt: string, context: Record<string, unknown>, options?: { fast?: boolean }): Promise<T> {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");

    const response = await this.client.messages.create({
      model: options?.fast ? HAIKU_MODEL : SONNET_MODEL,
      max_tokens: options?.fast ? 4096 : 8192,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nContext:\n${contextStr}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation.`,
        },
      ],
    });

    const text = extractText(response.content, "{}");
    return JSON.parse(stripFences(text)) as T;
  }
}
