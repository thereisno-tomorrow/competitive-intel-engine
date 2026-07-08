import { generateBattlecardSections } from "@/lib/generators/battlecard";
import { createLLMProvider } from "@/lib/llm/factory";
import { pingHealthcheck } from "@/lib/health/heartbeat";
import { InfraFault } from "../errors";
import type { JobRunner } from "../queue";
import type { GenerateCardJobData } from "./types";

/**
 * Worker card-regen job (U16/U17). Regenerates a competitor's living battlecard
 * sections through the trust pipeline, appending gated revisions. A fatal error
 * is an InfraFault so pg-boss retries; per-section validation/judge rejections are
 * handled inside the generator (they don't throw).
 */
export const generateCardJob: JobRunner<GenerateCardJobData> = async (data) => {
  const llm = createLLMProvider();
  try {
    const results = await generateBattlecardSections(llm, {
      competitorId: data.competitorId,
      reason: data.reason,
    });
    console.log(
      `[job:generate-card] ${data.competitorId} (${data.reason ?? "manual"}):`,
      JSON.stringify(results),
    );
    await pingHealthcheck();
  } catch (err) {
    throw new InfraFault(
      `card regen failed for ${data.competitorId}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
};
