import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    include: {
      brief: {
        include: { competitor: true },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: draft.id,
    briefId: draft.briefId,
    contentType: draft.contentType,
    segment: draft.segment,
    title: draft.title,
    content: draft.content,
    wordCount: draft.wordCount,
    version: draft.version,
    status: draft.status,
    generationMetadata: draft.generationMetadata,
    createdAt: draft.createdAt.toISOString(),
    brief: {
      id: draft.brief.id,
      title: draft.brief.title,
      angle: draft.brief.angle,
      bucket: draft.brief.bucket,
      funnelStage: draft.brief.funnelStage,
      competitorName: draft.brief.competitor?.name ?? null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updated = await prisma.contentDraft.update({
    where: { id },
    data: { status: body.status },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
  });
}
