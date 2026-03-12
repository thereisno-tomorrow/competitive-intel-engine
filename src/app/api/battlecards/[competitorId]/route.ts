import { prisma } from "@/lib/db";
import type { EvidenceTier } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import type {
  QuickDismiss,
  WhyWeWinPoint,
  WhyWeLosePoint,
  TrapQuestion,
  ProofPoint,
} from "@/types";

interface BattlecardWeakness {
  text: string;
  evidenceTier: EvidenceTier;
  sourceUrl: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> },
) {
  const { competitorId: idOrName } = await params;

  // Support lookup by competitor name (case-insensitive) as well as ID
  let competitorId = idOrName;
  if (!idOrName.startsWith("c") || idOrName.length < 20) {
    // Looks like a name slug, not a CUID — resolve to ID
    const competitor = await prisma.competitor.findFirst({
      where: { name: { equals: idOrName, mode: "insensitive" } },
      select: { id: true },
    });
    if (competitor) competitorId = competitor.id;
  }

  const battlecard = await prisma.battlecard.findUnique({
    where: { competitorId },
    include: {
      competitor: {
        include: {
          reframes: {
            include: {
              sourceItems: {
                select: { sourceUrl: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!battlecard) {
    return NextResponse.json(
      { error: "Battlecard not found", code: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    competitor: {
      id: battlecard.competitor.id,
      name: battlecard.competitor.name,
      tier: battlecard.competitor.tier,
    },
    whenTheyComeUp: battlecard.whenTheyComeUp,
    // Safe casts: Prisma Json fields validated at write time (seed.ts / battlecard generator)
    theirPitch: battlecard.theirPitch as string[],
    weaknesses: battlecard.weaknesses as unknown as BattlecardWeakness[],
    reframes: battlecard.competitor.reframes.map((r) => ({
      id: r.id,
      weakness: r.weakness,
      reframe: r.reframe,
      antiReframe: r.antiReframe,
      evidenceTier: r.evidenceTier,
      sources: r.sourceItems.map((s) => s.sourceUrl),
    })),
    openQuestions: battlecard.openQuestions as string[], // Safe cast: validated at write time
    overview: battlecard.overview,
    quickDismiss: battlecard.quickDismiss as QuickDismiss | null,
    whyWeWin: (battlecard.whyWeWin as unknown as WhyWeWinPoint[] | null) ?? [],
    whyWeLose: (battlecard.whyWeLose as unknown as WhyWeLosePoint[] | null) ?? [],
    trapQuestions: (battlecard.trapQuestions as unknown as TrapQuestion[] | null) ?? [],
    proofPoints: (battlecard.proofPoints as unknown as ProofPoint[] | null) ?? [],
    lastUpdated: battlecard.updatedAt.toISOString(),
  });
}
