import type { SourceType } from "@/generated/prisma/client";
import { extractTextContent } from "../diff-engine";
import type { Connector } from "../connector";

export interface SingleSurfaceOptions {
  sourceType: SourceType;
  /** Cap extracted text length. */
  maxChars?: number;
  /** Optional label prefix for the emitted title. */
  label?: string;
}

/**
 * Shared "single-surface scrape" connector (U19): discovers the source's own URL
 * as the one target, scrapes it via the injected transport, and extracts readable
 * text. Reused by the jobs (U21) and SEO (U22) connectors, and re-expresses the
 * existing website scrape. Emits NO evidence tier — tiering stays downstream.
 */
export function createSingleSurfaceConnector(opts: SingleSurfaceOptions): Connector {
  const maxChars = opts.maxChars ?? 8000;
  return {
    sourceType: opts.sourceType,
    discover: (source) => [source.url],
    async fetch(target, transport, source) {
      const html = await transport.getText(target);
      const text = extractTextContent(html).slice(0, maxChars);
      if (!text.trim()) return null;
      return {
        sourceType: opts.sourceType,
        sourceId: source.id,
        competitorId: source.competitorId,
        url: target,
        title: `${source.competitorName} — ${opts.label ?? opts.sourceType}`,
        text,
      };
    },
  };
}
