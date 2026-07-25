import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { fmtBDT } from "@/lib/format";
import { DatePicker } from "@/components/DatePicker";
import { Printer, Download, Calendar } from "lucide-react";
import { toast } from "sonner";

export function ReportsTab({ projectId }: { projectId: string }) {
  const [timeFilter, setTimeFilter] = useState<"all" | "month" | "year" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project-info", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/report`);
      return res.data;
    },
  });

  const filteredFinancials = useMemo(() => {
    if (!data)
      return {
        budget: 0,
        revenue: 0,
        expenses: 0,
        owner: 0,
        invest: 0,
        expByCat: {} as Record<string, number>,
        revBySource: {} as Record<string, number>,
        shareholders: [],
      };

    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);
    const currentYear = now.getFullYear().toString();

    const filterFn = (row: any) => {
      if (!row.date) return true;
      if (timeFilter === "month") return row.date.startsWith(currentYearMonth);
      if (timeFilter === "year") return row.date.startsWith(currentYear);
      if (timeFilter === "custom") {
        if (customStart && row.date < customStart) return false;
        if (customEnd && row.date > customEnd) return false;
      }
      return true;
    };

    const bRows = (data.budgets || []).filter(filterFn);
    const rRows = (data.revenues || []).filter(filterFn);
    const eRows = (data.expenses || []).filter(filterFn);
    const oRows = (data.ownerPayments || []).filter(filterFn);
    const siRows = (data.shareholderInvestments || []).filter(filterFn);

    const sum = (rows: any[]) => rows.reduce((s, x) => s + Number(x.amount ?? 0), 0);

    const expByCat = eRows.reduce((acc: Record<string, number>, row: any) => {
      const cat = row.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + Number(row.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const revBySource = rRows.reduce((acc: Record<string, number>, row: any) => {
      const src = row.source || "Other";
      acc[src] = (acc[src] || 0) + Number(row.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const investByShareholder = (id: any) =>
      siRows
        .filter((i: any) => i.shareholder_id === id)
        .reduce((s: number, i: any) => s + Number(i.amount), 0);

    return {
      budget: sum(bRows),
      revenue: sum(rRows),
      expenses: sum(eRows),
      owner: sum(oRows),
      invest: sum(siRows),
      expByCat,
      revBySource,
      shareholders: (data.shareholders || []).map((s: any) => ({
        ...s,
        invested: investByShareholder(s.id),
      })),
    };
  }, [data, timeFilter, customStart, customEnd]);

  const totalMoney = filteredFinancials.budget + filteredFinancials.revenue + filteredFinancials.invest;
  const deductMoney = filteredFinancials.expenses + filteredFinancials.owner;
  const profit = filteredFinancials.revenue - filteredFinancials.expenses;
  const net = totalMoney - deductMoney;

  function handlePrint() {
    window.print();
  }

  function handleExportReportCSV() {
    if (!data) return;
    const reportData = [
      ["Bag E Rahmat Holdings ERP - Project Financial Summary"],
      ["Project", project?.name || ""],
      ["Generated Date", new Date().toLocaleDateString()],
      ["Time Filter", timeFilter],
      [],
      ["Financial Formulas Summary", "Amount (BDT)"],
      ["Total Money (Budget + Revenue + Invest)", totalMoney],
      ["Deduct Money (Expenses + Owner Payments)", deductMoney],
      ["Remaining Net Cash Balance", net],
      ["Gross Profit / Loss (Revenue - Expenses)", profit],
      [],
      ["Detailed Breakdown Metric", "Amount (BDT)"],
      ["Total Budget", filteredFinancials.budget],
      ["Total Revenue", filteredFinancials.revenue],
      ["Total Expenses", filteredFinancials.expenses],
      ["Total Owner Payments", filteredFinancials.owner],
      ["Total Investments", filteredFinancials.invest],
      [],
      ["Expense Category", "Amount (BDT)"],
      ...Object.entries(filteredFinancials.expByCat).map(([cat, amt]) => [cat, amt]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + reportData.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `financial_report_${project?.name || "project"}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Financial report exported");
  }

  return (
    <div className="space-y-10 print:space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-gold" />
          <span className="text-sm font-medium">Period:</span>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-gold"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {timeFilter === "custom" && (
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <div className="min-w-0 flex-1">
                <DatePicker
                  value={customStart}
                  onChange={(val) => setCustomStart(val)}
                  placeholder="Start Date"
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">to</span>
              <div className="min-w-0 flex-1">
                <DatePicker
                  value={customEnd}
                  onChange={(val) => setCustomEnd(val)}
                  placeholder="End Date"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReportCSV}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-gold" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Printable Heading */}
      <div className="hidden print:block mb-4 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold text-black">Bag E Rahmat Holdings ERP</h1>
        <p className="text-sm text-gray-600">Financial & Activity Report for: {project?.name}</p>
        <p className="text-xs text-gray-500">Date Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">Financial Formula Summary</h2>
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading report data...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Total Money (Budget+Rev+Invest)"
              value={fmtBDT(totalMoney)}
              accent="green"
            />
            <StatCard
              label="Deduct Money (Exp+Owner)"
              value={fmtBDT(deductMoney)}
              accent="red"
            />
            <StatCard
              label="Gross Profit / Loss"
              value={fmtBDT(profit)}
              accent={profit >= 0 ? "green" : "red"}
            />
            <StatCard label="Remaining Balance" value={fmtBDT(net)} accent="gold" />
          </div>
        )}
      </section>

      {/* Breakdown Tables */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="noir-panel p-5 overflow-x-auto no-scrollbar">
          <h3 className="mb-3 font-display text-lg font-semibold">Expenses by Category</h3>
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(filteredFinancials.expByCat).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                    No expenses in this period.
                  </td>
                </tr>
              ) : (
                Object.entries(filteredFinancials.expByCat).map(([cat, amt]) => (
                  <tr key={cat} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{cat}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtBDT(Number(amt))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="noir-panel p-5 overflow-x-auto no-scrollbar">
          <h3 className="mb-3 font-display text-lg font-semibold">Revenue by Source</h3>
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(filteredFinancials.revBySource).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                    No revenue in this period.
                  </td>
                </tr>
              ) : (
                Object.entries(filteredFinancials.revBySource).map(([src, amt]) => (
                  <tr key={src} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{src}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtBDT(Number(amt))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">Shareholder Report</h2>
        {filteredFinancials.shareholders.length === 0 ? (
          <div className="noir-panel px-4 py-10 text-center text-muted-foreground">
            No shareholders found.
          </div>
        ) : (
          <>
            {/* Mobile / tablet: card list */}
            <div className="grid gap-3 lg:hidden">
              {filteredFinancials.shareholders.map((s: any) => {
                const pct = Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0);
                const count = Number(s.effective_share_count ?? s.share_count ?? 0);
                return (
                  <div key={s.id} className="noir-panel min-w-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-foreground">{s.name}</span>
                      <span className="shrink-0 font-medium gold-text">{fmtBDT(Number(s.invested))}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pct}% ownership{count > 0 && ` · ${count} ${count === 1 ? "Share" : "Shares"}`}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="noir-panel hidden overflow-hidden lg:block">
              <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Shareholder</th>
                    <th className="px-4 py-3 text-right">Ownership</th>
                    <th className="px-4 py-3 text-right">Total Invested</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFinancials.shareholders.map((s: any) => {
                    const pct = Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0);
                    const count = Number(s.effective_share_count ?? s.share_count ?? 0);
                    return (
                      <tr key={s.id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {pct}%
                          {count > 0 && (
                            <span className="block text-xs font-normal text-gold">
                              ({count} {count === 1 ? "Share" : "Shares"})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium gold-text">
                          {fmtBDT(Number(s.invested))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Shareholder Report section remains above */}
    </div>
  );
}
