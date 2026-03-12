// Shared constants for the content engine UI (briefs, drafts)

export const bucketLabels: Record<string, string> = {
  INTELLIGENCE_DRIVEN: "Intelligence-Driven",
  PRODUCT_DRIVEN: "Product-Driven",
  BUYER_JOURNEY: "Buyer Journey",
  CATEGORY_CREATION: "Category Creation",
};

export const bucketLabelsShort: Record<string, string> = {
  INTELLIGENCE_DRIVEN: "Intel-Driven",
  PRODUCT_DRIVEN: "Product",
  BUYER_JOURNEY: "Buyer Journey",
  CATEGORY_CREATION: "Category",
};

export const bucketColors: Record<string, string> = {
  INTELLIGENCE_DRIVEN: "bg-blue-100 text-blue-800",
  PRODUCT_DRIVEN: "bg-emerald-100 text-emerald-800",
  BUYER_JOURNEY: "bg-amber-100 text-amber-800",
  CATEGORY_CREATION: "bg-purple-100 text-purple-800",
};

export const funnelLabels: Record<string, string> = {
  AWARENESS: "Awareness",
  ACQUISITION: "Acquisition",
  ACTIVATION: "Activation",
  RETENTION: "Retention",
  EXPANSION: "Expansion",
};

export const segmentLabels: Record<string, string> = {
  STARTUP: "Startup",
  MSME: "MSME",
  MID_MARKET: "Mid-Market",
};

export const segmentColors: Record<
  string,
  { border: string; header: string; accent: string }
> = {
  STARTUP: {
    border: "border-blue-200/80",
    header: "border-blue-100",
    accent: "bg-blue-50 text-blue-700",
  },
  MSME: {
    border: "border-amber-200/80",
    header: "border-amber-100",
    accent: "bg-amber-50 text-amber-700",
  },
  MID_MARKET: {
    border: "border-emerald-200/80",
    header: "border-emerald-100",
    accent: "bg-emerald-50 text-emerald-700",
  },
};
