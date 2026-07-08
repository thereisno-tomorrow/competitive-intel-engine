import type { Connector } from "../connector";
import { createSingleSurfaceConnector } from "./single-surface";

/**
 * SEO/search-footprint connector (U22) — tracks a competitor's content/search
 * surface. Free + keyless, sharing the single-surface scrape factory with jobs
 * (U21). Lower-signal by design; kept cheap.
 */
export function createSeoConnector(): Connector {
  return createSingleSurfaceConnector({
    sourceType: "SEO",
    label: "SEO surface",
    maxChars: 6000,
  });
}
