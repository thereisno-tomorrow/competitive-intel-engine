import type { Connector } from "../connector";
import { createSingleSurfaceConnector } from "./single-surface";

/**
 * Jobs/hiring connector (U21) — intent signals from a competitor's careers page.
 * Free + keyless: a single-surface scrape via the shared HTML transport. Caps at
 * Inferred tier downstream (the connector itself never assigns a tier).
 */
export function createJobsConnector(): Connector {
  return createSingleSurfaceConnector({
    sourceType: "JOB_POSTING",
    label: "careers",
    maxChars: 6000,
  });
}
