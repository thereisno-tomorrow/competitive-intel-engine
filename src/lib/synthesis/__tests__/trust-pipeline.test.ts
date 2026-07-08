import { describe, it, expect, vi } from "vitest";
import { runTrustPipeline } from "../trust-pipeline";
import type { LLMProvider } from "@/lib/llm/provider";

function makeLLM(judgeResponses: unknown[]): {
  llm: LLMProvider;
  judgeCalls: () => number;
} {
  let i = 0;
  const classify = vi.fn().mockImplementation(async () => {
    const r = judgeResponses[Math.min(i, judgeResponses.length - 1)];
    i++;
    return r;
  });
  return {
    llm: { classifyStructured: classify, generateStructured: vi.fn() },
    judgeCalls: () => classify.mock.calls.length,
  };
}

const base = {
  maxAttempts: 3,
  outputType: "Test",
  rubricText: "RUBRIC",
  buildPrompt: (prev: string[] | undefined) => `PROMPT${prev ? ` FEEDBACK:${prev.join(",")}` : ""}`,
  generate: async (p: string) => ({ p }),
};

describe("runTrustPipeline", () => {
  it("PASSED when validators + judge pass on the first attempt", async () => {
    const { llm, judgeCalls } = makeLLM([{ violations: [] }]);
    const result = await runTrustPipeline({
      ...base,
      llm,
      validate: () => ({ valid: true, errors: [] }),
    });
    expect(result.status).toBe("PASSED");
    expect(result.attempts).toBe(1);
    expect(judgeCalls()).toBe(1);
  });

  it("does NOT call the judge while validators fail (cost control), ends REJECTED", async () => {
    const { llm, judgeCalls } = makeLLM([{ violations: [] }]);
    const result = await runTrustPipeline({
      ...base,
      llm,
      validate: () => ({ valid: false, errors: ["Missing sections"] }),
    });
    expect(result.status).toBe("REJECTED");
    expect(judgeCalls()).toBe(0); // judge never runs on invalid drafts
    expect(result.attempts).toBe(3);
  });

  it("REGENERATED when the judge fails once then passes, feeding violations back", async () => {
    const { llm } = makeLLM([
      { violations: [{ code: "SWAP_TEST_FAIL", message: "generic" }] },
      { violations: [] },
    ]);
    const prompts: string[] = [];
    const result = await runTrustPipeline({
      ...base,
      llm,
      buildPrompt: (prev) => {
        const p = `PROMPT${prev ? ` FEEDBACK:${prev.join(",")}` : ""}`;
        prompts.push(p);
        return p;
      },
      validate: () => ({ valid: true, errors: [] }),
    });
    expect(result.status).toBe("REGENERATED");
    expect(result.attempts).toBe(2);
    // The second prompt carries the judge's specific violation.
    expect(prompts[1]).toContain("SWAP_TEST_FAIL");
  });

  it("REJECTED when the judge fails every attempt", async () => {
    const { llm } = makeLLM([{ violations: [{ code: "X", message: "y" }] }]);
    const result = await runTrustPipeline({
      ...base,
      llm,
      validate: () => ({ valid: true, errors: [] }),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.judgeVerdict?.pass).toBe(false);
  });

  // --- U13: three-outcome close-call routing ---

  it("FLAGGED when the judge passes but raises soft warnings", async () => {
    const { llm } = makeLLM([
      { violations: [], warnings: [{ code: "SOFT_CONCERN", message: "borderline" }] },
    ]);
    const result = await runTrustPipeline({
      ...base,
      llm,
      validate: () => ({ valid: true, errors: [] }),
    });
    expect(result.status).toBe("FLAGGED");
    expect(result.judgeVerdict?.warnings[0]?.code).toBe("SOFT_CONCERN");
  });

  it("FLAGGED when it only passes cleanly on the final allowed attempt", async () => {
    const { llm } = makeLLM([
      { violations: [{ code: "A", message: "1" }] },
      { violations: [{ code: "B", message: "2" }] },
      { violations: [], warnings: [] }, // clean pass, but on attempt 3 of 3
    ]);
    const result = await runTrustPipeline({
      ...base,
      llm,
      validate: () => ({ valid: true, errors: [] }),
    });
    expect(result.status).toBe("FLAGGED");
    expect(result.attempts).toBe(3);
  });
});
