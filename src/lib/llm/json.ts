/** Thrown when an LLM response cannot be parsed as JSON. Typed so callers/tests can distinguish it. */
export class LLMParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "LLMParseError";
    this.raw = raw;
  }
}

/** Strip markdown code fences that models sometimes wrap around JSON output. */
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

/** Parse fenced-or-bare JSON from a model response, throwing a typed error on malformed output. */
export function parseStructured<T>(text: string): T {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new LLMParseError(
      `Failed to parse LLM response as JSON: ${(err as Error).message}`,
      text,
    );
  }
}
