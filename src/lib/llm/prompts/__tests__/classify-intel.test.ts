import { describe, it, expect } from "vitest";
import {
  buildBatchClassifyPrompt,
  buildClassifyIntelPrompt,
} from "../classify-intel";

const claims = [
  { id: "c1", claimText: "Mid-market treasury+payments", currentStatus: "HOLDING" },
] as never;

describe("classify prompts carry the sharpened noteworthy bar (U11)", () => {
  it("batch prompt includes INCLUDE + SKIP criteria and the SKIP type", () => {
    const prompt = buildBatchClassifyPrompt({
      competitorName: "Kyriba",
      articles: [
        {
          index: 0,
          title: "Kyriba launches AI forecasting",
          content: "…",
          sourceUrl: "https://kyriba.com/x",
          sourceType: "PRESS_RSS",
          changeType: "rss_new_item",
          pubDate: "2026-07-01",
        },
      ],
      claims,
    });
    expect(prompt).toContain("NOTEWORTHY BAR");
    expect(prompt).toContain("INCLUDE");
    expect(prompt).toContain("SKIP");
    // Guidance to not drop signal on uncertainty (recall protection).
    expect(prompt).toContain("INCLUDE it at a lower evidence tier");
  });

  it("single-article prompt includes the same bar", () => {
    const prompt = buildClassifyIntelPrompt({
      competitorName: "Airwallex",
      sourceType: "WEBSITE",
      sourceUrl: "https://airwallex.com",
      rawContent: "Some content",
      changeType: "content_change",
      claims,
      sourceCategory: "STATE",
      isFirstRun: false,
    });
    expect(prompt).toContain("NOTEWORTHY BAR");
    expect(prompt).toContain("Round-ups");
    // Single-article schema keeps SKIP as an explicit type option.
    expect(prompt).toContain('"SKIP"');
  });
});
