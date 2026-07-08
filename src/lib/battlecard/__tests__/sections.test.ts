import { describe, it, expect } from "vitest";
import {
  LIVING_SECTION_KEYS,
  extractBaselineContent,
  resolveCurrentRevision,
  isPublishedRevision,
} from "../sections";
import type { ValidationStatus } from "@/generated/prisma/client";

describe("extractBaselineContent", () => {
  it("maps the existing card + reframes into the four living sections, content intact", () => {
    const card = {
      weaknesses: [{ text: "payments-first", evidenceTier: "INFERRED" }],
      whyWeLose: [{ point: "150+ country payouts" }],
      openQuestions: ["Do they have SGD licensing?"],
    };
    const reframes = [
      { weakness: "no unified cash view", reframe: "ask about X", antiReframe: "don't say Y", evidenceTier: "CONFIRMED" },
    ];

    const baseline = extractBaselineContent(card, reframes);

    expect(Object.keys(baseline).sort()).toEqual([...LIVING_SECTION_KEYS].sort());
    expect(baseline.weaknesses).toEqual(card.weaknesses);
    expect(baseline.whyWeLose).toEqual(card.whyWeLose);
    expect(baseline.openQuestions).toEqual(card.openQuestions);
    expect(baseline.reframes).toEqual([
      { weakness: "no unified cash view", reframe: "ask about X", antiReframe: "don't say Y", evidenceTier: "CONFIRMED" },
    ]);
  });

  it("defaults null card fields to empty arrays", () => {
    const baseline = extractBaselineContent(
      { weaknesses: null, whyWeLose: null, openQuestions: null },
      [],
    );
    expect(baseline.weaknesses).toEqual([]);
    expect(baseline.whyWeLose).toEqual([]);
    expect(baseline.openQuestions).toEqual([]);
    expect(baseline.reframes).toEqual([]);
  });
});

describe("isPublishedRevision", () => {
  it("counts PASSED and REGENERATED as published", () => {
    expect(isPublishedRevision("PASSED")).toBe(true);
    expect(isPublishedRevision("REGENERATED")).toBe(true);
    expect(isPublishedRevision("FLAGGED")).toBe(false);
    expect(isPublishedRevision("REJECTED")).toBe(false);
  });
});

describe("resolveCurrentRevision", () => {
  const rev = (id: string, status: ValidationStatus, ms: number) => ({
    id,
    validationStatus: status,
    createdAt: new Date(ms),
  });

  it("returns the baseline (revision 1) when it is the only published revision", () => {
    const current = resolveCurrentRevision([rev("r1", "PASSED", 1000)]);
    expect(current?.id).toBe("r1");
  });

  it("returns the latest published revision over the baseline (living card updated)", () => {
    const current = resolveCurrentRevision([
      rev("r1", "PASSED", 1000),
      rev("r2", "REGENERATED", 2000),
    ]);
    expect(current?.id).toBe("r2");
  });

  it("ignores a newer FLAGGED/REJECTED revision — the last good one still shows", () => {
    const current = resolveCurrentRevision([
      rev("r1", "PASSED", 1000),
      rev("r2", "FLAGGED", 3000),
      rev("r3", "REJECTED", 4000),
    ]);
    expect(current?.id).toBe("r1");
  });

  it("returns null when nothing has published", () => {
    expect(resolveCurrentRevision([rev("r1", "FLAGGED", 1000)])).toBeNull();
    expect(resolveCurrentRevision([])).toBeNull();
  });
});
