import "dotenv/config";
import { prisma } from "@/lib/db";
import { FactoryProvider, buildModelConfig } from "@/lib/llm/factory";
import { OpenRouterClient } from "@/lib/llm/openrouter";
import { AnthropicClient } from "@/lib/llm/claude";
import { judgeOutput } from "@/lib/synthesis/judge";
import { loadRubric } from "@/lib/llm/rubric";
import { buildClassifyIntelPrompt } from "@/lib/llm/prompts/classify-intel";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * U14 — benchmark candidate models for the JUDGE and CLASSIFY steps against real
 * Finmo data, and print a defensible ranking. This is an evaluation harness, not
 * product code: its "test" is the recorded comparison it produces. Set the winner
 * into LLM_MODEL_JUDGE / LLM_MODEL_CLASSIFY afterward.
 *
 * Run: npx tsx -r dotenv/config src/scripts/benchmark-models.ts
 *
 * Cost warning: this makes real LLM calls across several candidate models. Keep
 * the sample small; the defaults below cap it.
 */

// Candidate models (OpenRouter slug or bare claude id). Edit freely.
const CANDIDATES = [
  "deepseek/deepseek-chat",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
];

const JUDGE_SAMPLE = 12; // stored outputs used as judge labels
const CLASSIFY_FIXTURES = join(
  process.cwd(),
  "docs",
  "rubric",
  "fixtures",
  "classify-labeled.json",
);

/** Build a provider whose judge+classify steps use `model`, draft stays default. */
function providerForModel(model: string): FactoryProvider {
  const config = buildModelConfig();
  config.judge = model;
  config.classify = model;
  return new FactoryProvider(config, {
    openrouter: new OpenRouterClient(process.env.OPENROUTER_API_KEY),
    anthropic: new AnthropicClient(),
  });
}

interface ClassifyFixture {
  competitorName: string;
  content: string;
  expected: "NOTEWORTHY" | "SKIP";
}

async function benchmarkJudge(rubricText: string) {
  // Labels: PASSED/REGENERATED outputs should PASS; REJECTED should FAIL.
  const outputs = await prisma.generatedOutput.findMany({
    where: { validationStatus: { in: ["PASSED", "REGENERATED", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
    take: JUDGE_SAMPLE,
  });
  if (outputs.length === 0) {
    console.log("[judge] no labeled outputs in the DB — skipping judge benchmark.");
    return;
  }

  console.log(`\n=== JUDGE benchmark (${outputs.length} labeled outputs) ===`);
  for (const model of CANDIDATES) {
    const llm = providerForModel(model);
    let agree = 0;
    for (const o of outputs) {
      const shouldPass = o.validationStatus !== "REJECTED";
      try {
        const verdict = await judgeOutput(llm, {
          outputType: o.type,
          content: o.content,
          rubricText,
        });
        if (verdict.pass === shouldPass) agree++;
      } catch (err) {
        console.error(`  ${model}: judge error on ${o.id}:`, err instanceof Error ? err.message : err);
      }
    }
    const pct = ((agree / outputs.length) * 100).toFixed(0);
    console.log(`  ${model.padEnd(32)} agreement ${pct}% (${agree}/${outputs.length})`);
  }
}

async function benchmarkClassify() {
  let fixtures: ClassifyFixture[];
  try {
    fixtures = JSON.parse(readFileSync(CLASSIFY_FIXTURES, "utf8")) as ClassifyFixture[];
  } catch {
    console.log(`\n[classify] no fixtures at ${CLASSIFY_FIXTURES} — skipping classify benchmark.`);
    console.log("  Create a JSON array of { competitorName, content, expected: 'NOTEWORTHY'|'SKIP' }.");
    return;
  }
  const claims = await prisma.positioningClaim.findMany();

  console.log(`\n=== CLASSIFY benchmark (${fixtures.length} labeled fixtures) ===`);
  for (const model of CANDIDATES) {
    const llm = providerForModel(model);
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const fx of fixtures) {
      const prompt = buildClassifyIntelPrompt({
        competitorName: fx.competitorName,
        sourceType: "PRESS_RSS",
        sourceUrl: "https://example.com",
        rawContent: fx.content,
        changeType: "rss_new_item",
        claims,
        sourceCategory: "EVENT",
        isFirstRun: false,
      });
      try {
        const r = await llm.classifyStructured<{ type?: string }>(prompt, { step: "classify" });
        const predictedNoteworthy = r.type !== "SKIP";
        const actualNoteworthy = fx.expected === "NOTEWORTHY";
        if (predictedNoteworthy && actualNoteworthy) tp++;
        else if (predictedNoteworthy && !actualNoteworthy) fp++;
        else if (!predictedNoteworthy && actualNoteworthy) fn++;
        else tn++;
      } catch (err) {
        console.error(`  ${model}: classify error:`, err instanceof Error ? err.message : err);
      }
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    console.log(
      `  ${model.padEnd(32)} precision ${(precision * 100).toFixed(0)}% recall ${(recall * 100).toFixed(0)}% (tp${tp} fp${fp} fn${fn} tn${tn})`,
    );
  }
}

async function main() {
  const rubric = loadRubric();
  console.log(`Benchmarking candidates against rubric v${rubric.version}`);
  console.log(`Candidates: ${CANDIDATES.join(", ")}`);
  await benchmarkJudge(rubric.text);
  await benchmarkClassify();
  console.log(
    "\nPick the best quality-per-dollar and set LLM_MODEL_JUDGE / LLM_MODEL_CLASSIFY.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
