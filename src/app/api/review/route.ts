import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * The "glance at these" queue (U13): outputs the trust pipeline parked as FLAGGED
 * (close calls) — never shown on the public dashboard, surfaced here for a quick
 * human approve/reject. Includes the judge's soft warnings so the reviewer sees
 * why it was flagged.
 */
export async function GET() {
  const flagged = await prisma.generatedOutput.findMany({
    where: { validationStatus: "FLAGGED" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: flagged.map((o) => ({
      id: o.id,
      type: o.type,
      headline: o.headline,
      publishedAt: o.publishedAt.toISOString(),
      content: o.content,
      rubricVersion: o.rubricVersion,
      judgeVerdict: o.judgeVerdict,
    })),
    total: flagged.length,
  });
}
