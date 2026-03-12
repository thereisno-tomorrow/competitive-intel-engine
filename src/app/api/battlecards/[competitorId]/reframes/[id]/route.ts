import { prisma } from "@/lib/db";
import type { EvidenceTier } from "@/generated/prisma/client";
import { validateBattlecardReframe } from "@/lib/synthesis/validators";
import { NextRequest, NextResponse } from "next/server";

interface ReframeUpdateBody {
  weakness?: string;
  reframe?: string;
  antiReframe?: string;
  evidenceTier?: EvidenceTier;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ competitorId: string; id: string }> },
) {
  const { competitorId, id } = await params;

  const existing = await prisma.battlecardReframe.findFirst({
    where: { id, competitorId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Reframe not found", code: "not_found" },
      { status: 404 },
    );
  }

  const rawBody = await request.json();
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return NextResponse.json(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 },
    );
  }
  const body = rawBody as ReframeUpdateBody;

  // Validate evidence tier if provided
  const newTier = body.evidenceTier ?? existing.evidenceTier;
  const validation = validateBattlecardReframe(newTier);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.join("; "), code: "validation_failed" },
      { status: 400 },
    );
  }

  const updated = await prisma.battlecardReframe.update({
    where: { id },
    data: {
      ...(body.weakness !== undefined && { weakness: body.weakness }),
      ...(body.reframe !== undefined && { reframe: body.reframe }),
      ...(body.antiReframe !== undefined && { antiReframe: body.antiReframe }),
      ...(body.evidenceTier !== undefined && {
        evidenceTier: body.evidenceTier,
      }),
    },
    include: {
      sourceItems: {
        select: { sourceUrl: true },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    competitorId: updated.competitorId,
    weakness: updated.weakness,
    reframe: updated.reframe,
    antiReframe: updated.antiReframe,
    evidenceTier: updated.evidenceTier,
    sources: updated.sourceItems.map((s) => s.sourceUrl),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
