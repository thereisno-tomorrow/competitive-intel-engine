/**
 * Run ingestion multiple times with a pause between runs.
 * Usage: npx tsx prisma/run-ingestion.ts [count]
 */

const RUNS = parseInt(process.argv[2] ?? "1", 10);
const INGEST_URL = "http://localhost:3000/api/cron/ingest";
const SECRET = process.env.CRON_SECRET ?? "warroom-local-dev";

async function ingest(run: number) {
  console.log(`\n--- Run ${run}/${RUNS} ---`);
  const start = Date.now();

  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  Fetched: ${data.itemsFetched ?? "?"} | Seen: -${data.seenSkipped ?? 0} | Title dedup: -${data.titleDedupBatchSkipped ?? 0} | Safety cap: -${data.safetyCapped ?? 0}`);
    console.log(`  LLM calls: ${data.llmCallsMade ?? 0} | Created: ${data.itemsCreated ?? 0} | Cost: $${(data.estimatedCostUsd ?? 0).toFixed(2)} (${elapsed}s)`);
    return data;
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`Running ingestion ${RUNS} time(s)...\n`);
  let totalCreated = 0;

  for (let i = 1; i <= RUNS; i++) {
    const result = await ingest(i);
    if (result) totalCreated += result.itemsCreated ?? 0;
  }

  console.log(`\nDone. Total new items created: ${totalCreated}`);
}

main();
