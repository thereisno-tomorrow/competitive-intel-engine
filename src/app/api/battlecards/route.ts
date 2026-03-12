import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const battlecards = await prisma.battlecard.findMany({
    include: {
      competitor: {
        include: {
          _count: { select: { reframes: true } },
        },
      },
    },
    orderBy: { competitor: { tier: "asc" } },
  });

  return NextResponse.json(
    battlecards.map((bc) => ({
      competitorId: bc.competitorId,
      competitorName: bc.competitor.name,
      tier: bc.competitor.tier,
      lastUpdated: bc.updatedAt.toISOString(),
      reframeCount: bc.competitor._count.reframes,
    })),
  );
}
