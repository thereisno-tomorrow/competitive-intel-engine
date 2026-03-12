import "dotenv/config";
import { prisma } from "../src/lib/db";

async function backfillEventDates() {
  console.log("Backfilling eventDate for existing intelligence items...");

  // Set eventDate = detectedAt for items that don't have eventDate (using raw SQL)
  const result = await prisma.$executeRaw`
    UPDATE intelligence_items
    SET event_date = detected_at
    WHERE event_date IS NULL
  `;

  console.log(`Updated ${result} intelligence items`);

  // For generated outputs (signal alerts), set eventDate to the earliest intelligence item's eventDate
  console.log("\nBackfilling eventDate for signal alerts...");

  const signalAlerts = await prisma.generatedOutput.findMany({
    where: { type: "SIGNAL_ALERT", eventDate: null },
    include: { intelligenceItems: true },
  });

  let alertsUpdated = 0;
  for (const alert of signalAlerts) {
    if (alert.intelligenceItems.length === 0) continue;

    // Use the eventDate of the first intelligence item
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

  await prisma.$disconnect();
}

backfillEventDates();
