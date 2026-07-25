import React from "react";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "gold" | "green" | "red";
}) {
  const accentCls =
    accent === "gold"
      ? "gold-text"
      : accent === "green"
      ? "text-[color:var(--success)]"
      : accent === "red"
      ? "text-[color:var(--destructive)]"
      : "";

  return (
    <div className="noir-panel p-5">
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-display text-2xl font-semibold ${accentCls}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
