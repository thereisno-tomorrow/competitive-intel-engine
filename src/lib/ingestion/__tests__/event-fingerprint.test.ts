import { describe, it, expect } from "vitest";
import { generateEventFingerprint, fuzzyFingerprintMatch } from "../event-fingerprint";

describe("generateEventFingerprint", () => {
  // -----------------------------------------------------------------------
  // eventKey path (primary)
  // -----------------------------------------------------------------------

  it("should use eventKey directly when provided", () => {
    const fp = generateEventFingerprint(
      "nium-c-suite-hires",
      "Nium announces three new C-suite hires",
    );
    expect(fp).toBe("nium-c-suite-hires");
  });

  it("should normalize eventKey casing and whitespace", () => {
    const fp = generateEventFingerprint(
      "Nium C-Suite Hires",
      "anything",
    );
    expect(fp).toBe("nium-c-suite-hires");
  });

  it("should trim eventKey whitespace", () => {
    const fp = generateEventFingerprint(
      "  nium-c-suite-hires  ",
      "anything",
    );
    expect(fp).toBe("nium-c-suite-hires");
  });

  it("should strip trailing YYYY-MM date patterns from eventKey", () => {
    expect(generateEventFingerprint("nium-c-suite-hires-2026-02", "x"))
      .toBe("nium-c-suite-hires");
    expect(generateEventFingerprint("nium-c-suite-hires-2025-05", "x"))
      .toBe("nium-c-suite-hires");
  });

  it("should strip trailing YYYY-only date patterns from eventKey", () => {
    expect(generateEventFingerprint("nium-c-suite-hires-2025", "x"))
      .toBe("nium-c-suite-hires");
  });

  it("should produce identical fingerprints regardless of date suffix", () => {
    const fp1 = generateEventFingerprint("nium-c-suite-hires-2026-02", "x");
    const fp2 = generateEventFingerprint("nium-c-suite-hires-2025-05", "x");
    const fp3 = generateEventFingerprint("nium-c-suite-hires-2025", "x");
    const fp4 = generateEventFingerprint("nium-c-suite-hires", "x");
    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
    expect(fp3).toBe(fp4);
  });

  it("should produce different fingerprints for different events", () => {
    const fp1 = generateEventFingerprint("nium-c-suite-hires", "anything");
    const fp2 = generateEventFingerprint("nium-series-b-funding", "anything");
    expect(fp1).not.toBe(fp2);
  });

  // -----------------------------------------------------------------------
  // Legacy fallback path
  // -----------------------------------------------------------------------

  it("should fall back to legacy algorithm when eventKey is undefined", () => {
    const fp = generateEventFingerprint(
      undefined,
      "Kyriba announces new AI-powered cash forecasting feature",
    );
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[a-f0-9]{16}$/);
  });

  it("should fall back to legacy algorithm when eventKey is empty string", () => {
    const fp = generateEventFingerprint(
      "",
      "Kyriba announces new AI-powered cash forecasting feature",
    );
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[a-f0-9]{16}$/);
  });

  it("should fall back to legacy algorithm when eventKey is whitespace-only", () => {
    const fp = generateEventFingerprint(
      "   ",
      "Kyriba announces new AI-powered cash forecasting feature",
    );
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[a-f0-9]{16}$/);
  });

  it("legacy fallback should be deterministic", () => {
    const summary = "Kyriba announces new AI-powered cash forecasting feature";
    const fp1 = generateEventFingerprint(undefined, summary);
    const fp2 = generateEventFingerprint(undefined, summary);
    expect(fp1).toBe(fp2);
  });

  it("legacy fallback should be case and punctuation insensitive", () => {
    const fp1 = generateEventFingerprint(undefined, "Trovata adds multi-currency support!");
    const fp2 = generateEventFingerprint(undefined, "TROVATA ADDS MULTI-CURRENCY SUPPORT");
    expect(fp1).toBe(fp2);
  });

  it("legacy fallback should be order-independent (sorted key terms)", () => {
    const fp1 = generateEventFingerprint(undefined, "Airwallex launches payment gateway Singapore");
    const fp2 = generateEventFingerprint(undefined, "Singapore gateway payment launches Airwallex");
    expect(fp1).toBe(fp2);
  });

  it("legacy fallback should handle empty or stop-word-only summaries", () => {
    const fp = generateEventFingerprint(undefined, "the a an is was");
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("fuzzyFingerprintMatch", () => {
  it("should match fingerprints differing by one action segment", () => {
    expect(fuzzyFingerprintMatch(
      "ripple-gtreasury-acquisition",
      "ripple-gtreasury-partnership",
    )).toBe(true);
  });

  it("should match exact duplicate fingerprints", () => {
    expect(fuzzyFingerprintMatch(
      "kyriba-ai-cash-forecasting-launch",
      "kyriba-ai-cash-forecasting-launch",
    )).toBe(true);
  });

  it("should not match completely different events", () => {
    expect(fuzzyFingerprintMatch(
      "ripple-gtreasury-acquisition",
      "nium-c-suite-hires",
    )).toBe(false);
  });

  it("should not match when only 1 segment shared", () => {
    expect(fuzzyFingerprintMatch(
      "ripple-treasury-launch",
      "ripple-hiring-expansion",
    )).toBe(false);
  });

  it("should skip legacy hex fingerprints (no hyphens)", () => {
    expect(fuzzyFingerprintMatch(
      "a1b2c3d4e5f6g7h8",
      "ripple-gtreasury-acquisition",
    )).toBe(false);
  });

  it("should not match when both are legacy hex fingerprints", () => {
    expect(fuzzyFingerprintMatch(
      "a1b2c3d4e5f6g7h8",
      "f9e8d7c6b5a4a3a2",
    )).toBe(false);
  });

  it("should match 4-segment keys differing by one segment", () => {
    expect(fuzzyFingerprintMatch(
      "airwallex-austrac-regulatory-scrutiny",
      "airwallex-austrac-regulatory-investigation",
    )).toBe(true);
  });

  it("should not match keys differing by 2+ segments", () => {
    expect(fuzzyFingerprintMatch(
      "nium-card-issuance-launch",
      "nium-treasury-platform-expansion",
    )).toBe(false);
  });

  it("should respect custom options", () => {
    // With relaxed maxDiff, allow 2 different segments
    expect(fuzzyFingerprintMatch(
      "ripple-treasury-platform-launch",
      "ripple-gtreasury-acquisition",
      { minSharedSegments: 1, maxDifferentSegments: 3 },
    )).toBe(true);
  });
});
