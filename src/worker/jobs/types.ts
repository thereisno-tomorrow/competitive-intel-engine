/** Durable job queue names. Values are the pg-boss queue identifiers. */
export const QUEUES = {
  INGEST: "ingest",
  GENERATE: "generate",
  GENERATE_CARD: "generate-card",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface IngestJobData {
  /** Reserved for future use (e.g. a specific source filter). */
  reason?: string;
}

export interface GenerateJobData {
  force?: boolean;
  pulseOnly?: boolean;
}

export interface GenerateCardJobData {
  competitorId: string;
  /** Human-readable "what triggered this" note for the changelog. */
  reason?: string;
}
