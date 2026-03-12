import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const brief = await prisma.contentBrief.findUnique({
    where: { id },
    include: {
      competitor: true,
      drafts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: brief.id,
    title: brief.title,
    angle: brief.angle,
    bucket: brief.bucket,
    funnelStage: brief.funnelStage,
    buyerProblem: brief.buyerProblem,
    treatments: brief.treatments,
    priorityScore: brief.priorityScore,
    priorityRationale: brief.priorityRationale,
    notes: brief.notes,
    status: brief.status,
    sourceId: brief.sourceId,
    competitorId: brief.competitorId,
    competitorName: brief.competitor?.name ?? null,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
    drafts: brief.drafts.map((d) => ({
      id: d.id,
      contentType: d.contentType,
      segment: d.segment,
      title: d.title,
      wordCount: d.wordCount,
      version: d.version,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updated = await prisma.contentBrief.update({
    where: { id },
    data: { status: body.status },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
  });
}
