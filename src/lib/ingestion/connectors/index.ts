import type { ConnectorRegistry } from "../connector";

/**
 * The default connector registry (plain Record — KTD7). New source connectors
 * (SEC/regulatory U20, jobs U21, SEO U22, LinkedIn U23) register here. A source
 * type with no connector is skipped loudly by the fan-out, never fatal.
 */
export function createDefaultConnectors(): ConnectorRegistry {
  return {
    // Populated by U20–U23.
  };
}
