import type { ConnectorRegistry } from "../connector";
import { createRegulatoryConnector } from "./regulatory";
import { createJobsConnector } from "./jobs";
import { createSeoConnector } from "./seo";

/**
 * The default connector registry (plain Record — KTD7). New source connectors
 * (SEC/regulatory U20, jobs U21, SEO U22, LinkedIn U23) register here. A source
 * type with no connector is skipped loudly by the fan-out, never fatal.
 */
export function createDefaultConnectors(): ConnectorRegistry {
  return {
    REGULATORY: createRegulatoryConnector(),
    JOB_POSTING: createJobsConnector(),
    SEO: createSeoConnector(),
    // LINKEDIN (U23) uses the existing PhantomBuster adapter path (see runner).
  };
}
