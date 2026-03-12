import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { normalizeGoogleNewsUrl } from "@/lib/ingestion/google-news-url";

export async function GET() {
  const validStatuses = ["PASSED", "REGENERATED"] as const;
  const statusFilter = { in: [...validStatuses] };

  const [latestWeekly, latestMonthly] = await Promise.all([
    prisma.generatedOutput.findFirst({
      where: { type: "WEEKLY_PULSE", validationStatus: statusFilter },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.generatedOutput.findFirst({
      where: { type: "MONTHLY_PULSE", validationStatus: statusFilter },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  if (!latestWeekly && !latestMonthly) {
    return NextResponse.json(
      { error: "No pulses found", code: "not_found" },
      { status: 404 },
    );
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [signalAlerts, claims] = await Promise.all([
    prisma.generatedOutput.findMany({
      where: {
        type: "SIGNAL_ALERT",
        validationStatus: statusFilter,
        eventDate: { gte: weekAgo },
      },
      orderBy: { eventDate: "desc" },
    }),
    prisma.positioningClaim.findMany({
      select: { id: true, claimText: true },
    }),
  ]);

  // Build lookup to resolve claim IDs → claim text in signal alert content
  const claimMap = new Map(claims.map((c) => [c.id, c.claimText]));

  const mapAlerts = (alerts: typeof signalAlerts) =>
    alerts.map((alert) => {
      const content = alert.content as Record<string, unknown>;
      const sections = content?.sections as Record<string, unknown> | undefined;

      // Resolve claimsAffected IDs to human-readable claim text
      if (sections?.claimsAffected && Array.isArray(sections.claimsAffected)) {
        sections.claimsAffected = (sections.claimsAffected as string[])
          .map((id) => claimMap.get(id) ?? id)
          .filter((text) => !/^c[a-z0-9]{20,}$/i.test(text)); // Drop unresolvable CUIDs
      }

      // Normalize Google News RSS redirect URLs → browser-clickable article URLs
      if (sections?.sourceUrls && Array.isArray(sections.sourceUrls)) {
        sections.sourceUrls = (sections.sourceUrls as string[]).map(normalizeGoogleNewsUrl);
      }

      return {
        id: alert.id,
        headline: alert.headline,
        publishedAt: alert.publishedAt.toISOString(),
        content,
      };
    });

  return NextResponse.json({
    latestWeekly: latestWeekly
      ? {
          publishedAt: latestWeekly.publishedAt.toISOString(),
          headline: latestWeekly.headline,
          content: latestWeekly.content,
        }
      : null,
    latestMonthly: latestMonthly
      ? {
          publishedAt: latestMonthly.publishedAt.toISOString(),
          headline: latestMonthly.headline,
          content: latestMonthly.content,
        }
      : null,
    signalAlertsThisWeek: mapAlerts(signalAlerts),
  });
}
