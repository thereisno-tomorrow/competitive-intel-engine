import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const limitParam = parseInt(searchParams.get("limit") ?? "20", 10);
  const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = isNaN(limitParam) ? 20 : Math.max(1, Math.min(limitParam, 100));
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const where: Record<string, unknown> = {
    validationStatus: { in: ["PASSED", "REGENERATED"] },
  };

  if (type === "weekly") where.type = "WEEKLY_PULSE";
  else if (type === "monthly") where.type = "MONTHLY_PULSE";
  else where.type = { in: ["WEEKLY_PULSE", "MONTHLY_PULSE"] };

  const [pulses, total] = await Promise.all([
    prisma.generatedOutput.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.generatedOutput.count({ where }),
  ]);

  return NextResponse.json({
    items: pulses.map((p) => ({
      id: p.id,
      type: p.type === "WEEKLY_PULSE" ? "weekly" : "monthly",
      publishedAt: p.publishedAt.toISOString(),
      headline: p.headline,
      content: p.content,
      wordCount: p.wordCount,
    })),
    total,
    limit,
    offset,
  });
}
