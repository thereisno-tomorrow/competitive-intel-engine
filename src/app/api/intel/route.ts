import { prisma } from "@/lib/db";
import type { IntelType, EvidenceTier } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const competitorId = searchParams.get("competitorId");
  const type = searchParams.get("type") as IntelType | null;
  const tier = searchParams.get("tier") as EvidenceTier | null;
  const simulated = searchParams.get("simulated");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = isNaN(limitParam) ? 50 : Math.max(1, Math.min(limitParam, 100));
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const where: Record<string, unknown> = {};

  if (competitorId) where.competitorId = competitorId;
  if (type) where.type = type;
  if (tier) where.evidenceTier = tier;
  if (simulated === "true") where.simulated = true;
  else if (simulated === "false") where.simulated = false;

  if (from ?? to) {
    const detectedAt: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'from' date", code: "bad_request" }, { status: 400 });
      }
      detectedAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'to' date", code: "bad_request" }, { status: 400 });
      }
      detectedAt.lte = toDate;
    }
    where.detectedAt = detectedAt;
  }

  const [items, total, lastSource] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where,
      include: { competitor: true },
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.intelligenceItem.count({ where }),
    prisma.dataSource.findFirst({
      where: { lastChecked: { not: null } },
      orderBy: { lastChecked: "desc" },
      select: { lastChecked: true },
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      competitor: { id: item.competitor.id, name: item.competitor.name },
      type: item.type,
      summary: item.summary,
      companyImplication: item.companyImplication,
      evidenceTier: item.evidenceTier,
      sourceUrl: item.sourceUrl,
      simulated: item.simulated,
      detectedAt: item.detectedAt.toISOString(),
    })),
    total,
    limit,
    offset,
    lastUpdated: lastSource?.lastChecked?.toISOString() ?? null,
  });
}
