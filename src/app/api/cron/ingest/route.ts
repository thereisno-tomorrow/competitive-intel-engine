import type { SourceType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { IngestionRunner } from "@/lib/ingestion/runner";
import type { IngestionAdapter } from "@/lib/ingestion/adapters/base";
import { WebsiteAdapter, ChangelogAdapter, StatusPageAdapter } from "@/lib/ingestion/adapters/html-page";
import { RssAdapter } from "@/lib/ingestion/adapters/rss";
import { LinkedInAdapter } from "@/lib/ingestion/adapters/linkedin";
import { createLLMProvider } from "@/lib/llm/factory";
import { validateCronSecret } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const adapters = new Map<SourceType, IngestionAdapter>([
    ["WEBSITE", new WebsiteAdapter()],
    ["CHANGELOG", new ChangelogAdapter()],
    ["PRESS_RSS", new RssAdapter()],
    ["STATUS_PAGE", new StatusPageAdapter()],
  ]);

  // LinkedIn adapter requires PhantomBuster API key — skip when not configured
  if (process.env.PHANTOMBUSTER_API_KEY) {
    adapters.set("LINKEDIN", new LinkedInAdapter());
  }

  const llm = createLLMProvider();
  const runner = new IngestionRunner(adapters, llm);

  try {
    const result = await runner.run();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[INGEST] Fatal error:", message, stack);
    return NextResponse.json(
      { error: message, stack },
      { status: 500 },
    );
  }
}
