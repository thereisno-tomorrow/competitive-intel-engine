import { prisma } from "@/lib/db";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { createLLMProvider } from "@/lib/llm/factory";
import { pingHealthcheck } from "@/lib/health/heartbeat";
import { materialCompetitorIds } from "@/lib/battlecard/retarget";
import { InfraFault } from "../errors";
import { enqueueGenerateCard, type JobRunner } from "../queue";
import { getActiveBoss } from "../boss-registry";
import type { IngestJobData } from "./types";

/**
 * After ingestion, enqueue a card-regen job for each competitor that received a
 * fresh MATERIAL signal this run (U17). Serialized per competitor via the singleton
 * key in enqueueGenerateCard. No boss (e.g. manual run) → skipped gracefully.
 */
async function retargetMaterialSignals(since: Date): Promise<void> {
  const boss = getActiveBoss();
  if (!boss) return;

  const items = await prisma.intelligenceItem.findMany({
    where: { createdAt: { gte: since }, simulated: false },
    include: { competitor: true, claimsAffected: true },
  });

  const competitorIds = materialCompetitorIds(items);
  for (const competitorId of competitorIds) {
    await enqueueGenerateCard(boss, competitorId, "material signal from ingestion");
  }
  if (competitorIds.length > 0) {
    console.log(`[job:ingest] retarget → ${competitorIds.length} card regen(s) enqueued`);
  }
}

/**
 * Worker ingest job. Runs the full ingestion pipeline with no time limit, then
 * enqueues living-card regeneration for competitors with material signals. A fatal
 * pipeline error is wrapped as an InfraFault so pg-boss retries.
 */
export const ingestJob: JobRunner<IngestJobData> = async () => {
  const since = new Date();
  const llm = createLLMProvider();
  try {
    const result = await runIngestionPipeline(llm);
    console.log("[job:ingest] complete:", JSON.stringify(result));
    await pingHealthcheck();
    await retargetMaterialSignals(since);
  } catch (err) {
    throw new InfraFault(
      `ingestion pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
};
