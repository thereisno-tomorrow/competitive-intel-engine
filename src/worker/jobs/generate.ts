import { runGeneratePipeline } from "@/lib/generators/generate-pipeline";
import { createLLMProvider } from "@/lib/llm/factory";
import { InfraFault } from "../errors";
import type { JobRunner } from "../queue";
import type { GenerateJobData } from "./types";

/**
 * Worker generate job. Runs pulses + signal alerts with no time limit (the whole
 * point of moving off Vercel Hobby's 60s cap). A fatal error is an InfraFault so
 * pg-boss retries; per-output validation rejections are handled inside the
 * generators (they don't throw here).
 */
export const generateJob: JobRunner<GenerateJobData> = async (data) => {
  const llm = createLLMProvider();
  try {
    const result = await runGeneratePipeline(llm, {
      force: data.force,
      pulseOnly: data.pulseOnly,
    });
    console.log("[job:generate] complete:", JSON.stringify(result));
  } catch (err) {
    throw new InfraFault(
      `generate pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
};
