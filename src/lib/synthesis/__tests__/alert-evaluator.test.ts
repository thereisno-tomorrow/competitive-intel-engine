import { describe, it, expect } from "vitest";
import { evaluateAlertThreshold } from "../alert-evaluator";

describe("alert-evaluator", () => {
  // --- Standalone triggers (always alert) ---

  it("triggers alert for pricing changes regardless of tier or claims", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_2",
      intelType: "PRICING_CHANGE",
      content: "New pricing announced",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reasons).toContain("Pricing change detected");
  });

  it("triggers alert for outage events", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_2",
      intelType: "OUTAGE",
      content: "Service degraded",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reasons).toContain("Outage detected");
  });

  it("triggers alert when 'treasury operating system' language detected", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_2",
      intelType: "PRESS",
      content: "We are the Treasury Operating System for enterprise",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reasons).toContain("'Treasury Operating System' language detected");
  });

  // --- Compound triggers (claim + high-impact type) ---

  it("triggers alert for MESSAGING_SHIFT when claim affected", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "MESSAGING_SHIFT",
      content: "New positioning language",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reasons).toContain("Positioning claim affected by messaging shift");
  });

  it("triggers alert for PRODUCT_CHANGE when claim affected", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_2",
      intelType: "PRODUCT_CHANGE",
      content: "Launched competing treasury platform",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reasons).toContain("Positioning claim affected by product change");
  });

  // --- Should NOT alert ---

  it("does NOT alert for MESSAGING_SHIFT without claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "MESSAGING_SHIFT",
      content: "New positioning language",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for PRODUCT_CHANGE without claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "PRODUCT_CHANGE",
      content: "Some product update",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for PARTNERSHIP even with claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "PARTNERSHIP",
      content: "Partnered with a football club",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for REGULATORY even with claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "REGULATORY",
      content: "Received EMI authorization",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for PRESS even with claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "PRESS",
      content: "CEO says IPO in 2028",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for HIRING_SIGNAL even with claim", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_1",
      intelType: "HIRING_SIGNAL",
      content: "Hiring treasury engineers",
      affectsPositioningClaims: true,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("does NOT alert for routine Tier 2 events", () => {
    const result = evaluateAlertThreshold({
      competitorTier: "TIER_2",
      intelType: "HIRING_SIGNAL",
      content: "Hiring a frontend engineer",
      affectsPositioningClaims: false,
    });
    expect(result.shouldAlert).toBe(false);
  });
});
