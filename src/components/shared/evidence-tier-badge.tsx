import { cn } from "@/lib/utils";
import type { EvidenceTier } from "@/generated/prisma/client";

const tierConfig: Record<
  EvidenceTier,
  { label: string; icon: string; className: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    icon: "\u2713",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  INFERRED: {
    label: "Inferred",
    icon: "~",
    className: "bg-amber-50 text-amber-700 border-amber-200 border-dashed",
  },
  UNKNOWN: {
    label: "Unknown",
    icon: "?",
    className: "bg-red-50 text-red-600 border-red-200 border-dashed",
  },
};

export function EvidenceTierBadge({ tier }: { tier: EvidenceTier }) {
  const config = tierConfig[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
        config.className
      )}
    >
      {config.icon} {config.label}
    </span>
  );
}
