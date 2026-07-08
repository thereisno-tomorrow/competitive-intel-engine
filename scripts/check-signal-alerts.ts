import "dotenv/config";

async function checkSignalAlerts() {
  const response = await fetch("http://localhost:3000/api/pulse/latest");
  const data = await response.json();

  console.log("\n=== SIGNAL ALERTS THIS WEEK ===");
  console.log(`Total: ${data.signalAlertsThisWeek.length}\n`);

  data.signalAlertsThisWeek.forEach((alert: { headline?: string; publishedAt?: string }, i: number) => {
    console.log(`${i + 1}. ${alert.headline}`);
    console.log(`   Published: ${alert.publishedAt}`);
    console.log("");
  });
}

checkSignalAlerts();
