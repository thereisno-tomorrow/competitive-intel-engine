import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Resolve a FLAGGED output (U13): approve → PASSED (publishes to the feed);
 * reject → REJECTED (hidden everywhere).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'", code: "bad_request" },
      { status: 400 },
    );
  }

  const existing = await prisma.generatedOutput.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Output not found", code: "not_found" },
      { status: 404 },
    );
  }
  if (existing.validationStatus !== "FLAGGED") {
    return NextResponse.json(
      { error: "Output is not flagged for review", code: "conflict" },
      { status: 409 },
    );
  }

  const updated = await prisma.generatedOutput.update({
    where: { id },
    data: { validationStatus: action === "approve" ? "PASSED" : "REJECTED" },
  });

  return NextResponse.json({ id: updated.id, validationStatus: updated.validationStatus });
}
