import { describe, it, expect } from "vitest";
import { validateWeeklyPulse } from "@/lib/synthesis/validators";
import { OUTPUT_LIMITS } from "@/lib/config/thresholds";
import type { WeeklyPulseContent } from "@/types";

// This test validates the full pipeline using mock data
// For real E2E testing, use the manual curl commands in PRD Section 20

describe("Smoke Test: Pipeline Validation", () => {
  it("validates a well-formed weekly pulse", () => {
    const pulse: WeeklyPulseContent = {
      sections: {
        topSignals: [
          {
            competitor: "Kyriba",
            summary: "Launched AI cash forecasting module",
            implication:
              "Directly challenges MO AI positioning — bolt-on narrative weakens",
            evidenceTier: "CONFIRMED",
            sourceUrl: "https://www.kyriba.com/blog/ai-cash-forecasting",
          },
        ],
        claimStatuses: [
          {
            claimId: "claim-1",
            claimText:
              "Only mid-market accessible platform combining full treasury + payments",
            status: "HOLDING",
            changeFromLastWeek: "unchanged",
          },
          {
            claimId: "claim-2",
            claimText:
              "AI-native treasury intelligence (MO AI) vs. bolt-on AI from legacy players",
            status: "UNDER_PRESSURE",
            changeFromLastWeek: "degraded",
          },
          {
            claimId: "claim-3",
            claimText: "Multi-jurisdiction licensing as compliance moat",
            status: "HOLDING",
            changeFromLastWeek: "unchanged",
          },
        ],
        actionRequired:
          "Review MO AI messaging in light of Kyriba AI launch",
        outlook:
          "AI positioning under increasing pressure. Treasury+payments claim stable.",
      },
    };

    const result = validateWeeklyPulse(
      pulse,
      OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a pulse missing evidence tiers", () => {
    const badPulse = {
      sections: {
        topSignals: [
          {
            competitor: "Kyriba",
            summary: "Some event",
            implication: "Some impact",
            // Missing evidenceTier
            sourceUrl: "https://kyriba.com",
          },
        ],
        claimStatuses: [],
        actionRequired: null,
        outlook: "Fine.",
      },
    } as unknown as WeeklyPulseContent;

    const result = validateWeeklyPulse(
      badPulse,
      OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a pulse exceeding word limit", () => {
    const longPulse: WeeklyPulseContent = {
      sections: {
        topSignals: Array.from({ length: 20 }, (_, i) => ({
          competitor: `Competitor ${i}`,
          summary:
            "A very long summary that contains many words to push past the limit ".repeat(
              5
            ),
          implication: "Extended implications text ".repeat(5),
          evidenceTier: "CONFIRMED" as const,
          sourceUrl: `https://example.com/${i}`,
        })),
        claimStatuses: [],
        actionRequired: "Lots of action ".repeat(50),
        outlook: "Extended outlook ".repeat(50),
      },
    };

    const result = validateWeeklyPulse(
      longPulse,
      OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("word limit"))).toBe(true);
  });

  it("validates quiet week pulse (nothing notable)", () => {
    const quietPulse: WeeklyPulseContent = {
      sections: {
        topSignals: [],
        claimStatuses: [
          {
            claimId: "c1",
            claimText: "Claim 1",
            status: "HOLDING",
            changeFromLastWeek: "unchanged",
          },
        ],
        actionRequired: null,
        outlook:
          "Nothing notable this week. All positioning claims holding.",
      },
    };

    const result = validateWeeklyPulse(
      quietPulse,
      OUTPUT_LIMITS.WEEKLY_PULSE_MAX_WORDS
    );
    expect(result.valid).toBe(true);
  });
});
