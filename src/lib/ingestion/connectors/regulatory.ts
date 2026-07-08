import type { Connector, ConnectorContent, ConnectorSource, Transport } from "../connector";
import { extractTextContent } from "../diff-engine";

/**
 * SEC/regulatory connector (U20) — the confirmed-fact anchor. Free + keyless.
 * Host-routed: SEC EDGAR JSON API (data.sec.gov) or the MAS financial-institutions
 * directory HTML (mas.gov.sg). Curated entry URLs are direct-pins (no fuzzy match).
 * Emits no tier — the downstream classifier decides (typically CONFIRMED-eligible).
 */

const MAX_FILINGS = 8;

interface SecSubmissions {
  cik?: string;
  name?: string;
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
}

/** Parse an SEC EDGAR submissions JSON into a readable recent-filings summary. */
export function parseSecSubmissions(data: SecSubmissions): {
  entityName: string;
  text: string;
  latestFilingDate?: string;
} | null {
  const recent = data.filings?.recent;
  if (!recent?.form || recent.form.length === 0) return null;
  const rows: string[] = [];
  const n = Math.min(recent.form.length, MAX_FILINGS);
  for (let i = 0; i < n; i++) {
    const form = recent.form[i] ?? "?";
    const date = recent.filingDate?.[i] ?? "?";
    const desc = recent.primaryDocDescription?.[i] ?? "";
    rows.push(`- ${date}: ${form}${desc ? ` — ${desc}` : ""}`);
  }
  return {
    entityName: data.name ?? "Unknown entity",
    latestFilingDate: recent.filingDate?.[0],
    text: `SEC EDGAR filings for ${data.name ?? "entity"} (CIK ${data.cik ?? "?"}):\n${rows.join("\n")}`,
  };
}

async function fetchSec(
  target: string,
  transport: Transport,
  source: ConnectorSource,
): Promise<ConnectorContent | null> {
  const data = await transport.getJson<SecSubmissions>(target);
  const parsed = parseSecSubmissions(data);
  if (!parsed) return null;
  return {
    sourceType: "REGULATORY",
    sourceId: source.id,
    competitorId: source.competitorId,
    url: target,
    title: `${parsed.entityName} — SEC EDGAR`,
    text: parsed.text,
    publishedAt: parsed.latestFilingDate,
  };
}

/** Parse a MAS FI directory page into licence class + status. */
export function parseMasDirectory(html: string): {
  licence?: string;
  status?: string;
  text: string;
} {
  const text = extractTextContent(html);
  const licence = text.match(/licen[cs]e\s*(?:type|class)?\s*[:\-]?\s*([^\n]{3,80})/i)?.[1]?.trim();
  const status = text.match(/status\s*[:\-]?\s*([^\n]{2,40})/i)?.[1]?.trim();
  const summary = [
    licence ? `Licence: ${licence}` : null,
    status ? `Status: ${status}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  return { licence, status, text: summary ? `${summary}\n\n${text.slice(0, 2000)}` : text.slice(0, 2000) };
}

async function fetchMas(
  target: string,
  transport: Transport,
  source: ConnectorSource,
): Promise<ConnectorContent | null> {
  const html = await transport.getText(target);
  const parsed = parseMasDirectory(html);
  if (!parsed.text.trim()) return null;
  return {
    sourceType: "REGULATORY",
    sourceId: source.id,
    competitorId: source.competitorId,
    url: target,
    title: `${source.competitorName} — MAS FI directory`,
    text: parsed.text,
  };
}

export function createRegulatoryConnector(): Connector {
  return {
    sourceType: "REGULATORY",
    discover: (source) => [source.url], // curated entry URL = direct-pin
    async fetch(target, transport, source) {
      let host: string;
      try {
        host = new URL(target).host;
      } catch {
        return null;
      }
      if (host.includes("sec.gov")) return fetchSec(target, transport, source);
      if (host.includes("mas.gov.sg")) return fetchMas(target, transport, source);
      console.warn(`[regulatory] unrouted host "${host}" for ${target} — skipping`);
      return null;
    },
  };
}
