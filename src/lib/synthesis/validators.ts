import type { EvidenceTier } from "@/generated/prisma/client";
import type { WeeklyPulseContent, MonthlyPulseContent, SignalAlertContent } from "@/types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function countContentWords(content: WeeklyPulseContent | MonthlyPulseContent | SignalAlertContent): number {
  return countWords(JSON.stringify(content).replace(/[{}\[\]",]/g, " "));
}

export function validateWeeklyPulse(content: WeeklyPulseContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.topSignals) errors.push("Missing topSignals");
  if (!content.sections?.claimStatuses) errors.push("Missing claimStatuses");
  if (content.sections?.outlook === undefined) errors.push("Missing outlook");

  // Evidence tier check
  content.sections?.topSignals?.forEach((signal, i) => {
    if (!signal.evidenceTier) errors.push(`Signal ${i}: missing evidence tier`);
    if (!signal.sourceUrl) errors.push(`Signal ${i}: missing source URL`);
  });

  // Word limit
  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

export function validateMonthlyPulse(content: MonthlyPulseContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.categoryHealth) errors.push("Missing categoryHealth");
  if (!content.sections?.positioningConfidence) errors.push("Missing positioningConfidence");
  if (!content.sections?.contentImplications?.length) errors.push("Missing content implications");

  // Company specificity: must have positioning confidence
  if (content.sections?.positioningConfidence?.length === 0) {
    errors.push("Company specificity: no positioning claim assessments");
  }

  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

export function validateSignalAlert(content: SignalAlertContent, wordLimit: number): ValidationResult {
  const errors: string[] = [];

  if (!content.sections) errors.push("Missing sections");
  if (!content.sections?.whatHappened) errors.push("Missing whatHappened");
  if (!content.sections?.whyItMatters) errors.push("Missing whyItMatters");
  if (!content.sections?.evidenceTier) errors.push("Missing evidenceTier");
  if (!content.sections?.recommendedResponse) errors.push("Missing recommendedResponse");

  // Company specificity check
  if (!content.sections?.claimsAffected?.length) {
    errors.push("Company specificity: no claims affected referenced");
  }

  // Source verification
  if (!content.sections?.sourceUrls?.length) {
    errors.push("Missing source URLs — every alert must cite sources");
  }

  const words = countContentWords(content);
  if (words > wordLimit) errors.push(`Exceeds word limit: ${words} > ${wordLimit}`);

  return { valid: errors.length === 0, errors };
}

export function validateBattlecardReframe(evidenceTier: EvidenceTier): ValidationResult {
  if (evidenceTier !== "CONFIRMED") {
    return {
      valid: false,
      errors: ["Battlecard reframes must be CONFIRMED tier only"],
    };
  }
  return { valid: true, errors: [] };
}
