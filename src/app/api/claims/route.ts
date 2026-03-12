import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const claims = await prisma.positioningClaim.findMany({
    include: {
      evidenceItems: {
        where: { simulated: false },
        select: { id: true, evidenceTier: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    claims.map((claim) => ({
      id: claim.id,
      claimText: claim.claimText,
      status: claim.currentStatus,
      lastAssessed: claim.lastAssessed?.toISOString() ?? null,
      evidenceForCount: claim.evidenceItems.filter(
        (e) => e.evidenceTier === "CONFIRMED",
      ).length,
      evidenceAgainstCount: claim.evidenceItems.filter(
        (e) => e.evidenceTier !== "CONFIRMED",
      ).length,
    })),
  );
}
