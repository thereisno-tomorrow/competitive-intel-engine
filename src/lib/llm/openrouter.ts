/**
 * Minimal OpenRouter client (OpenAI-compatible chat completions).
 * Used for the cheap drafting model (DeepSeek) and, optionally, a stronger
 * judge/classify model expressed in `provider/model` form.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string | undefined, baseUrl: string = OPENROUTER_URL) {
    this.apiKey = apiKey ?? "";
    this.baseUrl = baseUrl;
  }

  /** Single-turn completion. Returns the assistant text. Throws a clear error if the key is missing. */
  async complete(model: string, prompt: string, maxTokens: number): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        `OPENROUTER_API_KEY is required to call OpenRouter model "${model}" but is not set.`,
      );
    }

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `OpenRouter request failed (${res.status} ${res.statusText}) for model "${model}": ${detail.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(
        `OpenRouter returned no message content for model "${model}".`,
      );
    }
    return content;
  }
}
