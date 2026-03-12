import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const pulse = await prisma.generatedOutput.findUnique({
    where: { id: "cmlon135j00xtj8ecrxc73n79" },
    include: {
      intelligenceItems: {
        include: { competitor: true },
      },
    },
  });

  if (!pulse) {
    console.log("Pulse not found");
    return;
  }

  console.log("=== INTELLIGENCE ITEMS USED ===\n");
  pulse.intelligenceItems.forEach((item) => {
    console.log(`[${item.competitor.name}] ${item.type}`);
    console.log(`Summary: ${item.summary}`);
    console.log(`Evidence: ${item.evidenceTier}`);
    console.log(`Raw (first 300 chars): ${item.rawContent.substring(0, 300)}...`);
    console.log("");
  });

  console.log("\n=== GENERATED NARRATIVE ===");
  console.log(JSON.stringify(pulse.content, null, 2));

  await prisma.$disconnect();
}

main();
