import { NextRequest, NextResponse } from "next/server";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { createLLMProvider } from "@/lib/llm/factory";
import { validateCronSecret } from "@/lib/auth";

export const maxDuration = 300;

/**
 * Thin optional manual trigger. The scheduled execution path is the Fly worker
 * (src/worker/jobs/ingest.ts); this route delegates to the same shared pipeline.
 */
export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const llm = createLLMProvider();

  try {
    const result = await runIngestionPipeline(llm);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[INGEST] Fatal error:", message, stack);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
