export function SectionCard({
  title,
  guide,
  children,
  className = "",
  accent,
}: {
  title: string;
  guide: string;
  children: React.ReactNode;
  className?: string;
  accent?: "green" | "amber";
}) {
  const borderClass =
    accent === "green"
      ? "border-emerald-200/80"
      : accent === "amber"
        ? "border-amber-200/80"
        : "border-zinc-200/80";
  const headerBorderClass =
    accent === "green"
      ? "border-emerald-100"
      : accent === "amber"
        ? "border-amber-100"
        : "border-zinc-100";

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${borderClass} ${className}`}
    >
      <div className={`border-b px-5 py-3.5 ${headerBorderClass}`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-400">{guide}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
