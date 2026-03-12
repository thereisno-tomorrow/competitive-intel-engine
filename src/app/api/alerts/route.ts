import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limitParam = parseInt(searchParams.get("limit") ?? "20", 10);
  const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = isNaN(limitParam) ? 20 : Math.max(1, Math.min(limitParam, 100));
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const where = {
    type: "SIGNAL_ALERT" as const,
    validationStatus: { in: ["PASSED" as const, "REGENERATED" as const] },
  };

  const [alerts, total] = await Promise.all([
    prisma.generatedOutput.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.generatedOutput.count({ where }),
  ]);

  return NextResponse.json({
    items: alerts.map((a) => ({
      id: a.id,
      publishedAt: a.publishedAt.toISOString(),
      headline: a.headline,
      content: a.content,
      wordCount: a.wordCount,
    })),
    total,
    limit,
    offset,
  });
}
