import type { SourceType } from "@/generated/prisma/client";

/**
 * Injected transport (KTD7): connectors never hardwire HTTP. Tests pass a fake;
 * production passes the fetch-based default. Keeps connectors pure + testable.
 */
export interface Transport {
  getText(url: string, init?: RequestInit): Promise<string>;
  getJson<T = unknown>(url: string, init?: RequestInit): Promise<T>;
}

/** Minimal source shape a connector needs (a subset of DataSource + competitor). */
export interface ConnectorSource {
  id: string;
  type: SourceType;
  url: string;
  competitorId: string;
  competitorName: string;
}

/**
 * Typed content a connector emits. NOTE: there is deliberately NO evidenceTier
 * field — a connector never assigns its own trust tier (KTD7). Tiering stays in
 * the downstream classify/validator layer.
 */
export interface ConnectorContent {
  sourceType: SourceType;
  sourceId: string;
  competitorId: string;
  url: string;
  title: string;
  text: string;
  publishedAt?: string;
}

/**
 * One uniform connector contract: discover concrete fetch targets from a source,
 * then fetch each target's content via the injected transport. fetch returns null
 * on failure (isolated — a flaky target never fails the run).
 */
export interface Connector {
  sourceType: SourceType;
  discover(source: ConnectorSource): string[] | Promise<string[]>;
  fetch(
    target: string,
    transport: Transport,
    source: ConnectorSource,
  ): Promise<ConnectorContent | null>;
}

/** Plain registry (not v2's MapConnectorRegistry class) — just a lookup by type. */
export type ConnectorRegistry = Partial<Record<SourceType, Connector>>;

export interface ConnectorRunResult {
  content: ConnectorContent[];
  errors: Array<{ sourceId: string; error: string }>;
  /** Source types with no registered connector (skipped, not fatal). */
  skipped: string[];
}

export interface RunConnectorsOptions {
  /** Max total fetch targets across all sources (cost guard). Default 50. */
  budget?: number;
}

/**
 * Fan out over sources through their connectors. Disciplines (KTD7):
 * - unknown source type → loud log + skip (never throws),
 * - a connector whose discover/fetch throws is isolated; other sources complete,
 * - a total-fetch budget caps cost.
 */
export async function runConnectors(
  registry: ConnectorRegistry,
  sources: ConnectorSource[],
  transport: Transport,
  options: RunConnectorsOptions = {},
): Promise<ConnectorRunResult> {
  const budget = options.budget ?? 50;
  const content: ConnectorContent[] = [];
  const errors: ConnectorRunResult["errors"] = [];
  const skipped: string[] = [];
  let fetched = 0;

  for (const source of sources) {
    const connector = registry[source.type];
    if (!connector) {
      console.warn(`[connectors] no connector registered for source type "${source.type}" — skipping ${source.id}`);
      skipped.push(source.type);
      continue;
    }

    try {
      const targets = await connector.discover(source);
      for (const target of targets) {
        if (fetched >= budget) {
          console.warn(`[connectors] fetch budget (${budget}) reached — stopping early`);
          return { content, errors, skipped };
        }
        fetched++;
        try {
          const result = await connector.fetch(target, transport, source);
          if (result) content.push(result);
        } catch (err) {
          errors.push({
            sourceId: source.id,
            error: `fetch failed for ${target}: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    } catch (err) {
      // discover() failure is isolated to this source.
      errors.push({
        sourceId: source.id,
        error: `discover failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { content, errors, skipped };
}
