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
    <div className="noir-panel @container min-w-0 p-5">
      <div className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 truncate font-display text-base font-semibold leading-tight @[11rem]:text-lg @[15rem]:text-xl @[19rem]:text-2xl ${accentCls}`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
