import "dotenv/config";
import { execSync } from "child_process";

// This script pushes your Prisma schema to the Vercel (Neon) database
// You'll need to set VERCEL_DATABASE_URL in your .env first

const vercelDbUrl = process.env.VERCEL_DATABASE_URL;

if (!vercelDbUrl) {
  console.error("❌ VERCEL_DATABASE_URL not set in .env");
  console.log("\n📋 To get your Vercel database URL:");
  console.log("1. Go to Vercel project → Storage → neon-blue-ocean");
  console.log("2. Copy the POSTGRES_PRISMA_URL value");
  console.log("3. Add to .env as: VERCEL_DATABASE_URL=<value>");
  process.exit(1);
}

console.log("🚀 Pushing schema to Vercel database...\n");

try {
  // Set DATABASE_URL in process environment for Windows compatibility
  process.env.DATABASE_URL = vercelDbUrl;

  execSync("npx prisma db push", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("\n✅ Schema pushed successfully!");
  console.log("\n📝 Next: Run the seed script to add data");
} catch (error) {
  console.error("\n❌ Failed to push schema");
  process.exit(1);
}
