import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateBriefSuggestions } from "@/lib/llm/prompts/content-brief-suggestions";

export async function GET() {
  const briefs = await prisma.contentBrief.findMany({
    include: {
      competitor: true,
      _count: { select: { drafts: true } },
    },
    orderBy: { priorityScore: "desc" },
  });

  return NextResponse.json(
    briefs.map((b) => ({
      id: b.id,
      title: b.title,
      angle: b.angle,
      bucket: b.bucket,
      funnelStage: b.funnelStage,
      buyerProblem: b.buyerProblem,
      priorityScore: b.priorityScore,
      status: b.status,
      competitorName: b.competitor?.name ?? null,
      draftsCount: b._count.drafts,
      createdAt: b.createdAt.toISOString(),
    }))
  );
}

export async function POST() {
  // Fetch recent War Room data for the LLM
  const [recentIntel, recentOutputs, claims, existingBriefs, competitors] =
    await Promise.all([
      prisma.intelligenceItem.findMany({
        include: { competitor: true },
        orderBy: { detectedAt: "desc" },
        take: 30,
      }),
      prisma.generatedOutput.findMany({
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
      prisma.positioningClaim.findMany(),
      prisma.contentBrief.findMany({
        where: { status: { in: ["SUGGESTED", "APPROVED"] } },
      }),
      prisma.competitor.findMany({ select: { id: true, name: true } }),
    ]);

  // Build lookup: competitor name → id (for validating LLM output)
  const competitorByName = new Map(competitors.map((c) => [c.name, c.id]));
  const validCompetitorIds = new Set(competitors.map((c) => c.id));

  // Generate brief suggestions via LLM
  const suggestions = await generateBriefSuggestions({
    recentIntel,
    recentOutputs,
    claims,
    existingBriefs,
  });

  // Create ContentBrief records — validate competitorId before inserting
  const created = await Promise.all(
    suggestions.map((s) => {
      // Resolve competitorId: could be a valid ID, a name, or garbage from LLM
      let resolvedCompetitorId: string | null = null;
      if (s.competitorId) {
        if (validCompetitorIds.has(s.competitorId)) {
          resolvedCompetitorId = s.competitorId;
        } else if (competitorByName.has(s.competitorId)) {
          resolvedCompetitorId = competitorByName.get(s.competitorId)!;
        }
        // Otherwise drop it — LLM hallucinated an ID
      }

      return prisma.contentBrief.create({
        data: {
          title: s.title,
          angle: s.angle,
          bucket: s.bucket,
          funnelStage: s.funnelStage,
          buyerProblem: s.buyerProblem,
          treatments: s.treatments,
          priorityScore: s.priorityScore,
          priorityRationale: s.priorityRationale,
          notes: s.notes,
          sourceId: s.sourceId,
          competitorId: resolvedCompetitorId,
        },
        include: {
          competitor: true,
          _count: { select: { drafts: true } },
        },
      });
    })
  );

  return NextResponse.json(
    created.map((b) => ({
      id: b.id,
      title: b.title,
      angle: b.angle,
      bucket: b.bucket,
      funnelStage: b.funnelStage,
      buyerProblem: b.buyerProblem,
      priorityScore: b.priorityScore,
      status: b.status,
      competitorName: b.competitor?.name ?? null,
      draftsCount: b._count.drafts,
      createdAt: b.createdAt.toISOString(),
    }))
  );
}
