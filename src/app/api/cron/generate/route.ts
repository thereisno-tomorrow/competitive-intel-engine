import { NextRequest, NextResponse } from "next/server";
import { createLLMProvider } from "@/lib/llm/factory";
import { runGeneratePipeline } from "@/lib/generators/generate-pipeline";
import { validateCronSecret } from "@/lib/auth";

export const maxDuration = 300;

/**
 * Thin optional manual trigger. The scheduled execution path is the Fly worker
 * (src/worker/jobs/generate.ts); this route stays only for manual/local kicks and
 * delegates to the same shared pipeline. Vercel Hobby's 60s cap means the full
 * run can time out here — that's expected; the worker has no time limit.
 */
export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const llm = createLLMProvider();
  const force = url.searchParams.get("force") === "true";
  const pulseOnly = url.searchParams.get("pulseOnly") === "true";

  const result = await runGeneratePipeline(llm, { force, pulseOnly });
  return NextResponse.json({ success: true, ...result });
}
