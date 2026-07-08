import { describe, it, expect, vi } from "vitest";
import { judgeOutput } from "../judge";
import { InfraFault } from "@/lib/errors";
import type { LLMProvider } from "@/lib/llm/provider";

function llmReturning(response: unknown): LLMProvider {
  return {
    classifyStructured: vi.fn().mockResolvedValue(response),
    generateStructured: vi.fn(),
  };
}

const args = { outputType: "Weekly Pulse", content: { a: 1 }, rubricText: "RUBRIC" };

describe("judgeOutput", () => {
  it("passes when the judge returns no violations", async () => {
    const verdict = await judgeOutput(llmReturning({ violations: [] }), args);
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toEqual([]);
  });

  it("FAILs and lists the violated criteria", async () => {
    const verdict = await judgeOutput(
      llmReturning({
        violations: [
          { code: "SWAP_TEST_FAIL", message: "The lead sentence survives a competitor swap." },
        ],
      }),
      args,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.violations[0]?.code).toBe("SWAP_TEST_FAIL");
  });

  it("cannot carry rewritten content — extra fields are stripped (runtime guard)", async () => {
    const verdict = await judgeOutput(
      llmReturning({
        violations: [
          {
            code: "NO_MECHANISM",
            message: "adjective-only weakness",
            rewrittenContent: "here is a better version",
            fixedDraft: { sections: {} },
          },
        ],
      }),
      args,
    );
    const v = verdict.violations[0]!;
    expect(Object.keys(v).sort()).toEqual(["code", "message"]);
    expect(v).not.toHaveProperty("rewrittenContent");
  });

  it("fails closed when the verdict shape is ambiguous (no violations array)", async () => {
    const verdict = await judgeOutput(llmReturning({ verdict: "looks good" }), args);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations[0]?.code).toBe("JUDGE_AMBIGUOUS");
  });

  it("throws InfraFault on a judge call failure (job retries; never a pass)", async () => {
    const llm: LLMProvider = {
      classifyStructured: vi.fn().mockRejectedValue(new Error("429 rate limited")),
      generateStructured: vi.fn(),
    };
    await expect(judgeOutput(llm, args)).rejects.toBeInstanceOf(InfraFault);
  });

  it("routes the judge call to the judge step", async () => {
    const classify = vi.fn().mockResolvedValue({ violations: [] });
    await judgeOutput({ classifyStructured: classify, generateStructured: vi.fn() }, args);
    expect(classify).toHaveBeenCalledWith(expect.any(String), { step: "judge" });
  });
});
