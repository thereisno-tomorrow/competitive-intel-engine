import type { ConnectorRegistry } from "../connector";
import { createRegulatoryConnector } from "./regulatory";
import { createJobsConnector } from "./jobs";
import { createSeoConnector } from "./seo";
import { createLinkedInConnector } from "./linkedin";

/**
 * The default connector registry (plain Record — KTD7). New source connectors
 * (SEC/regulatory U20, jobs U21, SEO U22, LinkedIn U23) register here. A source
 * type with no connector is skipped loudly by the fan-out, never fatal.
 */
export function createDefaultConnectors(): ConnectorRegistry {
  const registry: ConnectorRegistry = {
    REGULATORY: createRegulatoryConnector(),
    JOB_POSTING: createJobsConnector(),
    SEO: createSeoConnector(),
  };
  // LinkedIn (U23) is env-gated: only register when a PhantomBuster key is present.
  if (process.env.PHANTOMBUSTER_API_KEY) {
    registry.LINKEDIN = createLinkedInConnector();
  }
  return registry;
}
