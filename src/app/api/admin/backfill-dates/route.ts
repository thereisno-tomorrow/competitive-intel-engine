import { prisma } from "@/lib/db";
import { validateCronSecret } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    console.log("Backfilling eventDate for intelligence items...");

    // Set eventDate = detectedAt for items without eventDate
    const itemsUpdated = await prisma.$executeRaw`
      UPDATE intelligence_items
      SET event_date = detected_at
      WHERE event_date IS NULL
    `;

    console.log(`Updated ${itemsUpdated} intelligence items`);

    // Set eventDate for signal alerts from their intelligence items
    const signalAlerts = await prisma.generatedOutput.findMany({
      where: { type: "SIGNAL_ALERT", eventDate: null },
      include: { intelligenceItems: true },
    });

    let alertsUpdated = 0;
    for (const alert of signalAlerts) {
      if (alert.intelligenceItems.length === 0) continue;

      const firstItem = alert.intelligenceItems[0];
      if (firstItem && firstItem.eventDate) {
        await prisma.generatedOutput.update({
          where: { id: alert.id },
          data: { eventDate: firstItem.eventDate },
        });
        alertsUpdated++;
      }
    }

    console.log(`Updated ${alertsUpdated} signal alerts`);

    return NextResponse.json({
      success: true,
      itemsUpdated,
      alertsUpdated,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Backfill failed", details: String(error) },
      { status: 500 },
    );
  }
}
