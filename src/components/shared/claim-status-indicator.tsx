import { cn } from "@/lib/utils";
import type { ClaimStatus } from "@/generated/prisma/client";

const statusConfig: Record<ClaimStatus, { label: string; dotClass: string; labelClass: string }> =
  {
    HOLDING: {
      label: "Holding",
      dotClass: "bg-emerald-500",
      labelClass: "text-emerald-700",
    },
    UNDER_PRESSURE: {
      label: "Under Pressure",
      dotClass: "bg-amber-500",
      labelClass: "text-amber-700",
    },
    CONTESTED: {
      label: "Contested",
      dotClass: "bg-red-500",
      labelClass: "text-red-700",
    },
  };

export function ClaimStatusIndicator({
  status,
  claimText,
}: {
  status: ClaimStatus;
  claimText: string;
}) {
  const config = statusConfig[status];
  return (
    <div className="min-w-0">
      {claimText && (
        <p className="text-sm font-semibold text-zinc-900 leading-snug mb-1.5">
          {claimText}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <div className={cn("h-2 w-2 shrink-0 rounded-full", config.dotClass)} />
        <span className={cn("text-xs font-medium", config.labelClass)}>
          {config.label}
        </span>
      </div>
    </div>
  );
}
