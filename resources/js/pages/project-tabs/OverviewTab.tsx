import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { fmtBDT, fmtDate } from "@/lib/format";
import { useSession, useIsAdmin } from "@/lib/session";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function OverviewTab({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const isAdmin = useIsAdmin();
  const [viewMode, setViewMode] = useState<"divided" | "full">("divided");

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["project-summary", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/summary`);
      return res.data;
    },
  });

  const { data: shareholders } = useQuery({
    queryKey: ["shareholders-overview", projectId],
    queryFn: async () => {
      const res = await api.get(`/shareholders?project_id=${projectId}`);
      return res.data;
    },
  });

  const { data: investments } = useQuery({
    queryKey: ["investments-overview", projectId],
    queryFn: async () => {
      const res = await api.get(`/shareholder-investments?project_id=${projectId}`);
      return res.data;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["project-recent", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/recent`);
      return res.data;
    },
  });

  // Current User's Shareholder record
  const mySh = (shareholders ?? []).find(
    (s: any) => String(s.user_id) === String(user?.id)
  ) ?? (shareholders ?? [])[0];

  const pct = Number(mySh?.effective_ownership_pct ?? mySh?.ownership_pct ?? 0);
  const count = Number(mySh?.effective_share_count ?? mySh?.share_count ?? 0);
  const totalShares = Number(project?.total_shareholders ?? 0);
  // Use the exact share_count / totalShares ratio for share_count-type holders instead of the
  // 2-decimal-rounded effective_ownership_pct, which introduces real currency drift at scale.
  const shareRatio =
    mySh?.share_type === "share_count" && totalShares > 0 && count > 0
      ? count / totalShares
      : pct > 0
      ? pct / 100
      : 1;

  // Personal logged investments for this shareholder
  const myLoggedInvestments = (investments ?? [])
    .filter((inv: any) => String(inv.shareholder_id) === String(mySh?.id))
    .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);

  const rawRevenue = summary?.revenue ?? 0;
  const rawExpenses = summary?.expenses ?? 0;
  const rawOwner = summary?.owner ?? 0;
  const rawProjectBudget = Number(project?.total_shareholder_project_price ?? summary?.budget ?? 0);
  const rawInvest = summary?.invest ?? 0;

  // Check if active view is divided share or full project
  const isDividedView = !isAdmin && viewMode === "divided" && mySh && pct > 0;

  const projectBudget = isDividedView ? rawProjectBudget * shareRatio : rawProjectBudget;
  const revenue = isDividedView ? rawRevenue * shareRatio : rawRevenue;
  const expenses = isDividedView ? rawExpenses * shareRatio : rawExpenses;
  const owner = isDividedView ? rawOwner * shareRatio : rawOwner;
  const invest = isDividedView ? myLoggedInvestments : rawInvest;
  const profit = revenue - expenses;
  const netCashBalance = (revenue + invest) - (expenses + owner);

  // Expenses grouped by category
  const byCat = Object.entries(
    (summary?.expensesRows ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.category ?? "Other"] = (acc[r.category ?? "Other"] ?? 0) + Number(r.amount);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Revenues grouped by month
  const byMonth = Object.entries(
    (summary?.revenuesRows ?? []).reduce((acc: Record<string, number>, r: any) => {
      const m = (r.date ?? "").slice(0, 7);
      acc[m] = (acc[m] ?? 0) + Number(r.amount);
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const goldColors = ["#c9a84c", "#e8c473", "#8b7331", "#f0d78c", "#a68938", "#d6b862"];

  return (
    <>
      {!isAdmin && mySh && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-surface-1 p-4 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">
              Shareholder Equity View
            </div>
            <div className="text-sm text-foreground mt-0.5">
              Showing breakdown for <span className="font-semibold text-gold">{mySh.name}</span> ({pct}% Equity{count > 0 ? ` · ${count} Shares` : ""})
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
            <button
              onClick={() => setViewMode("divided")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                viewMode === "divided"
                  ? "bg-gold text-slate-950 font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Divided Share ({pct}%)
            </button>
            <button
              onClick={() => setViewMode("full")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                viewMode === "full"
                  ? "bg-gold text-slate-950 font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Full Project Totals
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={isDividedView ? "My Share Budget" : "Project Budget"}
          value={fmtBDT(projectBudget)}
          hint={isDividedView ? `${pct}% of total budget` : undefined}
        />
        <StatCard
          label={isDividedView ? "My Revenue Share" : "Revenue"}
          value={fmtBDT(revenue)}
          accent="green"
        />
        <StatCard
          label={isDividedView ? "My Expense Share" : "Expenses"}
          value={fmtBDT(expenses)}
          accent="red"
        />
        <StatCard
          label={isDividedView ? "My Owner Payments" : "Owner Payments"}
          value={fmtBDT(owner)}
        />
        <StatCard
          label={isDividedView ? "My Paid Investment" : "Investments"}
          value={fmtBDT(invest)}
        />
        <StatCard
          label={isDividedView ? "My Net Cash Balance" : "Net Cash Balance"}
          value={fmtBDT(netCashBalance)}
          accent="gold"
          hint={`Profit Share: ${fmtBDT(profit)}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="noir-panel p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Revenue by month</h3>
          <div className="mt-4 h-64">
            {byMonth.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No revenue recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="amount" fill="var(--gold)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="noir-panel p-5">
          <h3 className="font-display text-lg font-semibold">Expenses by category</h3>
          <div className="mt-4 h-64">
            {byCat.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No expenses yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCat}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {byCat.map((_, i) => (
                      <Cell key={i} fill={goldColors[i % goldColors.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="noir-panel overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <h3 className="font-display text-lg font-semibold">Recent transactions</h3>
          </div>

          {(recent ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-muted-foreground">No transactions yet.</div>
          ) : (
            <>
              {/* Mobile / tablet: card list */}
              <div className="divide-y divide-border/40 lg:hidden">
                {recent?.map((r: any) => (
                  <div key={`${r.kind}-${r.id}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          r.kind === "Revenue"
                            ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                            : r.kind === "Expense"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-gold/15 text-gold"
                        }`}
                      >
                        {r.kind}
                      </span>
                      <span className="font-medium text-foreground">{fmtBDT(r.amount)}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-foreground">{r.label ?? r.description ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtDate(r.date)}</div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto no-scrollbar lg:block">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Detail</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent?.map((r: any) => (
                    <tr key={`${r.kind}-${r.id}`} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(r.date)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            r.kind === "Revenue"
                              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                              : r.kind === "Expense"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-gold/15 text-gold"
                          }`}
                        >
                          {r.kind}
                        </span>
                      </td>
                      <td className="px-5 py-3">{r.label ?? r.description ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-medium">{fmtBDT(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
