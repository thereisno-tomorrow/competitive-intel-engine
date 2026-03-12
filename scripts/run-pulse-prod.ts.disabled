import "dotenv/config";

// This script runs pulse generation locally but writes to your Vercel (production) database

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;

if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set in .env");
  process.exit(1);
}

// Temporarily override DATABASE_URL to point to production
const originalDbUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = vercelDbUrl;

console.log("💡 Generating pulse analysis...\n");

async function main() {
  // Import after setting DATABASE_URL
  const { PulseRunner } = await import("../src/lib/pulse/runner");
  const { ClaudeProvider } = await import("../src/lib/llm/claude");

  const llm = new ClaudeProvider();
  const runner = new PulseRunner(llm);

  try {
    const result = await runner.run();
    console.log("\n✅ Pulse generation complete!");
    console.log(`\n📊 Generated ${result.created} pulse insights`);
    console.log(`💰 Cost: $${result.cost.toFixed(2)}`);
    console.log("\n🚀 Check your site to see the pulse!");
  } catch (err) {
    console.error("\n❌ Pulse generation failed:", err);
    process.exit(1);
  } finally {
    // Restore original DATABASE_URL
    process.env.DATABASE_URL = originalDbUrl;
  }
}

main();
