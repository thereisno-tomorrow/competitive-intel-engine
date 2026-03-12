import "dotenv/config";
import { execSync } from "child_process";

// This script seeds your Vercel (Neon) database with demo data
// You'll need to set VERCEL_DATABASE_URL in your .env first

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;

if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set in .env");
  console.log("\n📋 To get your Vercel database URL:");
  console.log("1. Go to Vercel project → Settings → Environment Variables");
  console.log("2. Copy the POSTGRES_PRISMA_URL value");
  console.log("3. Add to .env as: VERCEL_DATABASE_URL=<value>");
  process.exit(1);
}

console.log("🌱 Seeding Vercel database...\n");

try {
  // Set DATABASE_URL in process environment for Windows compatibility
  process.env.DATABASE_URL = vercelDbUrl;

  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("\n✅ Database seeded successfully!");
  console.log("\n🚀 Your site should now be working!");
  console.log("\n📝 Next: Visit your Vercel deployment URL to see the app");
} catch (error) {
  console.error("\n❌ Failed to seed database");
  process.exit(1);
}
