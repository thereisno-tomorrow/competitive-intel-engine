import { describe, it, expect } from "vitest";
import {
  isMaterialSignal,
  materialCompetitorIds,
  affectedSections,
  type RetargetItem,
} from "../retarget";
import { LIVING_SECTION_KEYS } from "../sections";

describe("isMaterialSignal", () => {
  it("treats a pricing change as material", () => {
    expect(
      isMaterialSignal({
        competitorTier: "TIER_1",
        intelType: "PRICING_CHANGE",
        content: "New enterprise tier",
        affectsPositioningClaims: false,
      }),
    ).toBe(true);
  });

  it("treats an outage as material", () => {
    expect(
      isMaterialSignal({
        competitorTier: "TIER_2",
        intelType: "OUTAGE",
        content: "Status page incident",
        affectsPositioningClaims: false,
      }),
    ).toBe(true);
  });

  it("treats a claim-affecting product change as material", () => {
    expect(
      isMaterialSignal({
        competitorTier: "TIER_1",
        intelType: "PRODUCT_CHANGE",
        content: "New AI module",
        affectsPositioningClaims: true,
      }),
    ).toBe(true);
  });

  it("treats a plain press item as NOT material", () => {
    expect(
      isMaterialSignal({
        competitorTier: "TIER_2",
        intelType: "PRESS",
        content: "Won an award",
        affectsPositioningClaims: false,
      }),
    ).toBe(false);
  });
});

describe("materialCompetitorIds", () => {
  const item = (competitorId: string, type: RetargetItem["type"], claim = false): RetargetItem => ({
    competitorId,
    competitor: { tier: "TIER_1" },
    type,
    rawContent: "…",
    claimsAffected: claim ? [{}] : [],
  });

  it("returns exactly one id per competitor with a material signal (deduped)", () => {
    const ids = materialCompetitorIds([
      item("X", "PRICING_CHANGE"),
      item("X", "OUTAGE"), // second material signal for X → still one X
      item("Y", "PRESS"), // not material
    ]);
    expect(ids).toEqual(["X"]);
  });

  it("returns nothing when no signal is material", () => {
    expect(materialCompetitorIds([item("X", "PRESS"), item("Y", "HIRING_SIGNAL")])).toEqual([]);
  });
});

describe("affectedSections", () => {
  it("is the coarse living-section set", () => {
    expect(affectedSections()).toEqual(LIVING_SECTION_KEYS);
  });
});
