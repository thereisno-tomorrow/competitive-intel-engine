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
   * Download and parse JSON results from the S3 URL returned by fetchLatestOutput.
   * Handles both standard JSON arrays and newline-delimited JSON (NDJSON).
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

    const text = await response.text();

    // Try standard JSON array first
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed as T[];
      return [parsed] as T[];
    } catch {
      // Fall back to NDJSON (newline-delimited JSON)
      return text
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as T);
    }
  }
}
