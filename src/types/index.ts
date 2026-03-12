import type {
  EvidenceTier,
  ClaimStatus,
  IntelType,
} from "@/generated/prisma/client";

// === Output Content Schemas (JSON in GeneratedOutput.content) ===

export interface WeeklyPulseContent {
  sections: {
    topSignals: Array<{
      competitor: string;
      summary: string;
      implication: string;
      evidenceTier: EvidenceTier;
      sourceUrl: string;
      temporalContext?: string | null;  // Intelligence Layer field
    }>;
    claimStatuses: Array<{
      claimId: string;
      claimText: string;
      status: ClaimStatus;
      changeFromLastWeek: "improved" | "unchanged" | "degraded";
    }>;
    actionRequired: string | null;
    outlook: string;
    // Intelligence Layer section (optional for backward compatibility)
    offensiveOpportunities?: Array<{
      competitor: string;
      theirMove: string;
      exposedWeakness: string;
      companyOpportunity: string;
    }>;
  };
}

export interface MonthlyPulseContent {
  sections: {
    categoryHealth: string;
    tier1Shifts: Array<{
      competitor: string;
      narrative: string;
      evidenceTier: EvidenceTier;
      // Intelligence Layer fields (optional for backward compatibility)
      threatStatus?: "DORMANT" | "EMERGING" | "ACTIVE" | "CRITICAL";
      velocity?: "ACCELERATING" | "STABLE" | "DECELERATING" | "UNKNOWN";
      offensiveOpportunity?: string | null;
    }>;
    tier2Watch: Array<{
      competitor: string;
      signal: string;
    }>;
    positioningConfidence: Array<{
      claimId: string;
      claimText: string;
      status: ClaimStatus;
      evidenceForCount: number;
      evidenceAgainstCount: number;
      assessment: string;
    }>;
    contentImplications: string[];
    // Intelligence Layer sections (optional for backward compatibility)
    crossCompetitorPatterns?: Array<{
      pattern: string;
      competitors: string[];
      implication: string;
      urgency: "HIGH" | "MEDIUM" | "LOW";
    }>;
    knownUnknowns?: Array<{
      question: string;
      whyItMatters: string;
      recommendedAction: string;
    }>;
    threatStatusSummary?: {
      critical: string[];
      active: string[];
      emerging: string[];
      dormant: string[];
    };
  };
}

export interface SignalAlertContent {
  sections: {
    whatHappened: string;
    whyItMatters: string;
    evidenceTier: EvidenceTier;
    claimsAffected: string[];
    recommendedResponse: string;
    actionItems: string[];
    sourceUrls: string[];
    // Intelligence Layer sections (optional for backward compatibility)
    temporalContext?: {
      signalType: "LEAD" | "LAG" | "UNKNOWN";
      priorSignalsLast60Days: number;
      velocity: "ACCELERATING" | "STABLE" | "FIRST_SIGNAL";
      confidenceEvolution: string | null;
    };
    strategicContext?: {
      moveType: "POSITIONING" | "PRODUCT" | "GTM";
      inferredIntent: string;
      segment: "ENTERPRISE" | "MID_MARKET" | "MSME" | "STARTUP" | "ALL";
      offensiveOpportunity: string | null;
    };
  };
}

// === API Response Types ===

export interface LatestPulseResponse {
  type: "weekly" | "monthly";
  publishedAt: string;
  headline: string;
  content: WeeklyPulseContent | MonthlyPulseContent;
  signalAlertsThisWeek: Array<{
    id: string;
    headline: string;
    publishedAt: string;
    content: SignalAlertContent;
  }>;
}

interface PulseData {
  publishedAt: string;
  headline: string;
}

export interface DashboardResponse {
  latestWeekly: (PulseData & { content: WeeklyPulseContent }) | null;
  latestMonthly: (PulseData & { content: MonthlyPulseContent }) | null;
  signalAlertsThisWeek: Array<{
    id: string;
    headline: string;
    publishedAt: string;
    content: SignalAlertContent;
  }>;
}

export interface BattlecardSummary {
  competitorId: string;
  competitorName: string;
  tier: "TIER_1" | "TIER_2";
  lastUpdated: string;
  reframeCount: number;
}

// === Battlecard Section Types ===

export interface QuickDismiss {
  keyDismissals: string[];
  talkTrack: string;
}

export interface WhyWeWinPoint {
  point: string;
  context: string;
  action: string;
  evidenceTier: EvidenceTier;
}

export interface WhyWeLosePoint {
  point: string;
  context: string;
  action: string;
  evidenceTier: EvidenceTier;
}

export interface TrapQuestion {
  question: string;
  whyItWorks: string;
  followUp: string;
}

export interface ProofPoint {
  type: "case_study" | "switch_story" | "quote";
  text: string;
  source?: string;
  url?: string;
}

export interface BattlecardDetail {
  competitor: { id: string; name: string; tier: string };
  whenTheyComeUp: string;
  theirPitch: string[];
  weaknesses: Array<{ text: string; evidenceTier: EvidenceTier; sourceUrl: string }>;
  reframes: Array<{
    id: string;
    weakness: string;
    reframe: string;
    antiReframe: string;
    evidenceTier: EvidenceTier;
    sources: string[];
  }>;
  openQuestions: string[];
  overview: string | null;
  quickDismiss: QuickDismiss | null;
  whyWeWin: WhyWeWinPoint[];
  whyWeLose: WhyWeLosePoint[];
  trapQuestions: TrapQuestion[];
  proofPoints: ProofPoint[];
  lastUpdated: string;
}

export interface ClaimSummary {
  id: string;
  claimText: string;
  status: ClaimStatus;
  lastAssessed: string | null;
  evidenceForCount: number;
  evidenceAgainstCount: number;
}

export interface IntelItem {
  id: string;
  competitor: { id: string; name: string };
  type: IntelType;
  summary: string;
  companyImplication: string | null;
  evidenceTier: EvidenceTier;
  sourceUrl: string;
  simulated: boolean;
  detectedAt: string;
}

export interface IntelResponse {
  items: IntelItem[];
  total: number;
  limit: number;
  offset: number;
  lastUpdated: string | null;
}

export interface IntelFilters {
  competitorId?: string;
  type?: IntelType;
  tier?: EvidenceTier;
  simulated?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// === Config Types ===

export interface AlertThresholds {
  tier1CompetitorInvolved: boolean;
  positioningClaimAffected: boolean;
  pricingChange: boolean;
  outage: boolean;
  negativePressEvent: boolean;
  treasuryOSLanguageDetected: boolean;
}
