import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { createLLMProvider } from "@/lib/llm/factory";
import { pingHealthcheck } from "@/lib/health/heartbeat";
import { InfraFault } from "../errors";
import type { JobRunner } from "../queue";
import type { IngestJobData } from "./types";

/**
 * Worker ingest job. Runs the full ingestion pipeline with no time limit. A
 * fatal pipeline error is wrapped as an InfraFault so pg-boss retries it (a
 * transient scrape/network failure should not be treated as terminal).
 */
export const ingestJob: JobRunner<IngestJobData> = async () => {
  const llm = createLLMProvider();
  try {
    const result = await runIngestionPipeline(llm);
    console.log("[job:ingest] complete:", JSON.stringify(result));
    await pingHealthcheck();
  } catch (err) {
    throw new InfraFault(
      `ingestion pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
};
