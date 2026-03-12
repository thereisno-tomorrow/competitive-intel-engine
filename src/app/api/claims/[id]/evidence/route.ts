import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const claim = await prisma.positioningClaim.findUnique({
    where: { id },
    include: {
      evidenceItems: {
        include: { competitor: true },
        orderBy: { detectedAt: "desc" },
      },
    },
  });

  if (!claim) {
    return NextResponse.json(
      { error: "Claim not found", code: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    claim: {
      id: claim.id,
      claimText: claim.claimText,
      status: claim.currentStatus,
    },
    evidence: claim.evidenceItems.map((item) => ({
      id: item.id,
      competitor: item.competitor.name,
      type: item.type,
      summary: item.summary,
      companyImplication: item.companyImplication,
      evidenceTier: item.evidenceTier,
      sourceUrl: item.sourceUrl,
      simulated: item.simulated,
      detectedAt: item.detectedAt.toISOString(),
    })),
  });
}
