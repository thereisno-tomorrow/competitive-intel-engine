const DEFAULT_BASE_URL = "https://api.phantombuster.com/api/v2";
const DEFAULT_TIMEOUT_MS = 15_000;

interface PhantomBusterConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface PhantomOutput {
  containerId: string;
  status: string;
  resultObject: string | null;
  exitMessage: string;
  lastEndedAt: string | null;
}

export class PhantomBusterClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: PhantomBusterConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Fetch the latest completed output for a phantom agent.
   * Does NOT launch a new run — retrieves cached results from the most recent execution.
   */
  async fetchLatestOutput(agentId: string): Promise<PhantomOutput> {
    const url = `${this.baseUrl}/agents/fetch-output?id=${encodeURIComponent(agentId)}`;

    const response = await fetch(url, {
      headers: { "X-Phantombuster-Key-1": this.apiKey },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 401) {
      throw new Error("PhantomBuster API: invalid API key (401)");
    }
    if (response.status === 404) {
      throw new Error(`PhantomBuster API: phantom agent not found: ${agentId} (404)`);
    }
    if (response.status === 429) {
      throw new Error("PhantomBuster API: rate limited (429). Retry later.");
    }
    if (!response.ok) {
      throw new Error(`PhantomBuster API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<PhantomOutput>;
  }

  /**
   * Corrected v2 retrieval flow (U23): fetch the latest output, then resolve its
   * `resultObject`. In the v2 API `resultObject` is USUALLY the results JSON
   * inline (a string), not an S3 URL — the ported client always treated it as a
   * URL, which broke retrieval. This handles both: inline JSON is parsed directly;
   * an http(s) value is fetched then parsed.
   */
  async fetchResults<T = Record<string, unknown>>(agentId: string): Promise<T[]> {
    const output = await this.fetchLatestOutput(agentId);
    const resultObject = output.resultObject?.trim();
    if (!resultObject) return [];
    if (/^https?:\/\//i.test(resultObject)) {
      return this.fetchResultJson<T>(resultObject);
    }
    return parseResultText<T>(resultObject);
  }

  /**
   * Download and parse JSON results from an S3 URL. Handles standard JSON arrays
   * and newline-delimited JSON (NDJSON).
   */
  async fetchResultJson<T = Record<string, unknown>>(resultUrl: string): Promise<T[]> {
    const response = await fetch(resultUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 403) {
      throw new Error("PhantomBuster result URL expired (403). Re-fetch the output to get a fresh URL.");
    }
    if (!response.ok) {
      throw new Error(`PhantomBuster result fetch error: ${response.status}`);
    }

    return parseResultText<T>(await response.text());
  }
}

/** Parse a PhantomBuster result payload: JSON array/object or NDJSON. */
export function parseResultText<T = Record<string, unknown>>(text: string): T[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    return [parsed] as T[];
  } catch {
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  }
}
