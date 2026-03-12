import type { CompetitorTier, IntelType } from "@/generated/prisma/client";

interface AlertEvalInput {
  competitorTier: CompetitorTier;
  intelType: IntelType;
  content: string;
  affectsPositioningClaims: boolean;
}

interface AlertEvalResult {
  shouldAlert: boolean;
  reasons: string[];
}

/** Always alert regardless of claims */
const STANDALONE_ALERT_TYPES: IntelType[] = ["PRICING_CHANGE", "OUTAGE"];

/** Only alert when a positioning claim is also affected */
const CLAIM_SENSITIVE_TYPES: IntelType[] = ["PRODUCT_CHANGE", "MESSAGING_SHIFT"];

export function evaluateAlertThreshold(input: AlertEvalInput): AlertEvalResult {
  const reasons: string[] = [];

  // Standalone triggers — always alert
  if (STANDALONE_ALERT_TYPES.includes(input.intelType)) {
    if (input.intelType === "PRICING_CHANGE") reasons.push("Pricing change detected");
    if (input.intelType === "OUTAGE") reasons.push("Outage detected");
  }

  // Compound trigger — high-impact type + positioning claim affected
  if (input.affectsPositioningClaims && CLAIM_SENSITIVE_TYPES.includes(input.intelType)) {
    reasons.push("Positioning claim affected by " + input.intelType.toLowerCase().replace("_", " "));
  }

  // Keyword trigger — existential category threat
  if (/treasury\s+operating\s+system/i.test(input.content)) {
    reasons.push("'Treasury Operating System' language detected");
  }

  return { shouldAlert: reasons.length > 0, reasons };
}
