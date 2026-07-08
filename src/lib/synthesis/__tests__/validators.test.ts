import { describe, it, expect } from "vitest";
import {
  validateWeeklyPulse,
  validateMonthlyPulse,
  validateSignalAlert,
  validateBattlecardReframe,
  validateTierMonotonicity,
  validateLossCondition,
  countWords,
} from "../validators";
import type { WeeklyPulseContent, MonthlyPulseContent, SignalAlertContent } from "@/types";

describe("validators", () => {
  describe("countWords", () => {
    it("counts words correctly", () => {
      expect(countWords("hello world")).toBe(2);
      expect(countWords("one two three four five")).toBe(5);
    });

    it("handles empty string", () => {
      expect(countWords("")).toBe(0);
    });
  });

  describe("validateWeeklyPulse", () => {
    const validPulse: WeeklyPulseContent = {
      sections: {
        topSignals: [{
          competitor: "Kyriba",
          summary: "Launched AI feature",
          implication: "Threatens MO AI positioning claim",
          evidenceTier: "CONFIRMED",
          sourceUrl: "https://kyriba.com/blog",
        }],
        claimStatuses: [{
          claimId: "c1",
          claimText: "Mid-market treasury+payments",
          status: "HOLDING",
          changeFromLastWeek: "unchanged",
        }],
        actionRequired: null,
        outlook: "Competitive landscape stable this week.",
      },
    };

    it("passes valid weekly pulse", () => {
      const result = validateWeeklyPulse(validPulse, 100);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects pulse exceeding word limit", () => {
      const result = validateWeeklyPulse(validPulse, 5);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("word limit"))).toBe(true);
    });

    it("rejects pulse with missing evidence tiers", () => {
      const invalid = structuredClone(validPulse);
      // @ts-expect-error -- testing invalid input
      invalid.sections.topSignals[0].evidenceTier = undefined;
      const result = validateWeeklyPulse(invalid, 500);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateMonthlyPulse", () => {
    const validMonthly: MonthlyPulseContent = {
      sections: {
        categoryHealth: "Treasury management category remains competitive.",
        tier1Shifts: [{
          competitor: "Kyriba",
          narrative: "Expanding AI treasury capabilities",
          evidenceTier: "CONFIRMED",
        }],
        tier2Watch: [{
          competitor: "GTreasury",
          signal: "Launched mid-market Essentials tier",
        }],
        positioningConfidence: [{
          claimId: "c1",
          claimText: "Mid-market treasury+payments",
          status: "HOLDING",
          evidenceForCount: 3,
          evidenceAgainstCount: 1,
          assessment: "Claim holds despite GTreasury entry.",
        }],
        contentImplications: ["Update AI messaging to counter HighRadius claims"],
      },
    };

    it("passes valid monthly pulse", () => {
      const result = validateMonthlyPulse(validMonthly, 500);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects monthly pulse without positioning confidence (Company specificity)", () => {
      const invalid = structuredClone(validMonthly);
      invalid.sections.positioningConfidence = [];
      const result = validateMonthlyPulse(invalid, 500);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Company specificity"))).toBe(true);
    });

    it("rejects monthly pulse without content implications", () => {
      const invalid = structuredClone(validMonthly);
      invalid.sections.contentImplications = [];
      const result = validateMonthlyPulse(invalid, 500);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateSignalAlert", () => {
    const validAlert: SignalAlertContent = {
      sections: {
        whatHappened: "Kyriba launched AI cash forecasting",
        whyItMatters: "Directly challenges MO AI positioning claim",
        evidenceTier: "CONFIRMED",
        claimsAffected: ["Mid-market treasury+payments"],
        recommendedResponse: "Accelerate MO AI roadmap communications",
        actionItems: ["Update battlecard", "Brief sales team"],
        sourceUrls: ["https://kyriba.com/blog/ai"],
      },
    };

    it("passes valid signal alert", () => {
      const result = validateSignalAlert(validAlert, 500);
      expect(result.valid).toBe(true);
    });

    it("rejects alert without claims affected (Company specificity check)", () => {
      const invalid = structuredClone(validAlert);
      invalid.sections.claimsAffected = [];
      const result = validateSignalAlert(invalid, 500);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Company specificity"))).toBe(true);
    });

    it("rejects alert without source URLs", () => {
      const invalid = structuredClone(validAlert);
      invalid.sections.sourceUrls = [];
      const result = validateSignalAlert(invalid, 500);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateBattlecardReframe", () => {
    it("passes Confirmed tier reframe", () => {
      const result = validateBattlecardReframe("CONFIRMED");
      expect(result.valid).toBe(true);
    });

    it("rejects Inferred tier reframe", () => {
      const result = validateBattlecardReframe("INFERRED");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Battlecard reframes must be CONFIRMED tier only");
    });

    it("rejects Unknown tier reframe", () => {
      const result = validateBattlecardReframe("UNKNOWN");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateTierMonotonicity", () => {
    it("fails when output claims CONFIRMED but best cited source is only INFERRED", () => {
      const result = validateTierMonotonicity(["CONFIRMED"], ["INFERRED", "UNKNOWN"]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/CONFIRMED.*INFERRED/);
    });

    it("passes when output tier equals the best cited tier", () => {
      expect(validateTierMonotonicity(["INFERRED"], ["INFERRED"]).valid).toBe(true);
      expect(validateTierMonotonicity(["CONFIRMED"], ["CONFIRMED", "INFERRED"]).valid).toBe(true);
    });

    it("passes when output tier is below the best cited tier (downgrade allowed)", () => {
      expect(validateTierMonotonicity(["UNKNOWN"], ["CONFIRMED"]).valid).toBe(true);
    });

    it("is N/A (valid) when there are no tiered sources — source-verification handles that", () => {
      expect(validateTierMonotonicity(["CONFIRMED"], []).valid).toBe(true);
      expect(validateTierMonotonicity(["CONFIRMED"], [null, undefined]).valid).toBe(true);
    });

    it("flags each over-claiming signal in a multi-signal output", () => {
      const result = validateTierMonotonicity(
        ["CONFIRMED", "UNKNOWN", "CONFIRMED"],
        ["INFERRED"],
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("validateLossCondition", () => {
    it("fails an empty (all-'we win') section", () => {
      expect(validateLossCondition([]).valid).toBe(false);
      expect(validateLossCondition(null).valid).toBe(false);
    });

    it("fails a section of empty entries", () => {
      expect(validateLossCondition([{ point: "" }, ""]).valid).toBe(false);
    });

    it("passes when at least one honest weakness/loss condition has substance", () => {
      expect(
        validateLossCondition([{ point: "Loses on 150+ country payouts", action: "qualify out" }]).valid,
      ).toBe(true);
      expect(validateLossCondition(["They win on breadth"]).valid).toBe(true);
    });
  });
});
