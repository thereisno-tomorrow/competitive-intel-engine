import type { Connector, ConnectorContent } from "../connector";
import { PhantomBusterClient } from "@/lib/phantombuster/client";
import { parsePhantomUrl } from "../adapters/linkedin";
import { INGESTION } from "@/lib/config/thresholds";

/**
 * LinkedIn connector (U23) via PhantomBuster, behind the connector contract and
 * wired live. Env-gated on PHANTOMBUSTER_API_KEY (loud no-op → null if absent).
 * Reuses parsePhantomUrl and the corrected v2 retrieval flow (client.fetchResults).
 * Emits no tier — classification decides downstream.
 */
export function createLinkedInConnector(client?: PhantomBusterClient): Connector {
  return {
    sourceType: "LINKEDIN",
    discover: (source) => [source.url], // pb://{agentId}/posts|jobs|company
    async fetch(target, _transport, source): Promise<ConnectorContent | null> {
      const apiKey = process.env.PHANTOMBUSTER_API_KEY;
      if (!apiKey) {
        console.warn("[linkedin] PHANTOMBUSTER_API_KEY not set — skipping LinkedIn source");
        return null;
      }

      let agentId: string;
      let phantomType: string;
      try {
        ({ agentId, phantomType } = parsePhantomUrl(target));
      } catch (err) {
        console.warn(`[linkedin] ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }

      const pb = client ?? new PhantomBusterClient({ apiKey });
      let results: Record<string, unknown>[];
      try {
        results = await pb.fetchResults(agentId);
      } catch (err) {
        console.warn(
          `[linkedin] fetch failed for ${agentId}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }

      if (results.length === 0) return null;

      const text = summarizeLinkedIn(phantomType, results);
      if (!text.trim()) return null;

      return {
        sourceType: "LINKEDIN",
        sourceId: source.id,
        competitorId: source.competitorId,
        url: target,
        title: `${source.competitorName} — LinkedIn ${phantomType}`,
        text,
      };
    },
  };
}

/** Compact human-readable summary of the most recent LinkedIn items for classification. */
export function summarizeLinkedIn(
  phantomType: string,
  results: Record<string, unknown>[],
): string {
  const recent = results.slice(0, INGESTION.MAX_ITEMS_ON_FIRST_RUN);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const lines = recent.map((r) => {
    if (phantomType === "jobs") {
      return `JOB: ${str(r.title)}${r.location ? ` (${str(r.location)})` : ""} — ${str(r.description).slice(0, 200)}`;
    }
    if (phantomType === "company") {
      return `COMPANY: ${str(r.name)} | ${str(r.tagline)} | employees: ${str(r.employeeCount) || "?"} | ${str(r.description).slice(0, 200)}`;
    }
    // posts (default)
    return `POST: ${str(r.text).slice(0, 300)}${r.likeCount != null ? ` (likes: ${String(r.likeCount)})` : ""}`;
  });

  return `Recent LinkedIn ${phantomType} activity:\n${lines.join("\n")}`;
}
