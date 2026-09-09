import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { fmtBDT } from "@/lib/format";
import { DatePicker } from "@/components/DatePicker";
import { Printer, Download, Calendar, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } from "docx";

type TimeFilter = "today" | "week" | "month" | "year" | "all" | "custom";

const PERIOD_LABELS: Record<TimeFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

// Monday–Sunday of the week `now` falls in — a calendar week, matching how
// "This Month"/"This Year" are already calendar periods rather than a
// rolling "last 7 days" window.
function currentWeekRange(now: Date): { start: string; end: string } {
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

export function ReportsTab({ projectId }: { projectId: string }) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project-info", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  // Same queryKey AppShell uses for the app header, so this reuses that
  // cached fetch instead of firing a second /settings request — and stays
  // in sync if the logo/name is ever changed from Admin > Settings.
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data;
    },
  });
  const reportAppName = settings?.app_name ?? "Bag E Rahmat";
  const reportAppSubtitle = settings?.app_subtitle ?? "Holdings ERP";
  const reportAppLogo = settings?.app_logo ?? null;

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
        materialsCost: 0,
        laborCost: 0,
        materialsBySupplier: {} as Record<string, number>,
        expByCat: {} as Record<string, number>,
        revBySource: {} as Record<string, number>,
        shareholders: [],
      };

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekRange = currentWeekRange(now);
    const currentYearMonth = now.toISOString().slice(0, 7);
    const currentYear = now.getFullYear().toString();

    const filterFn = (row: any) => {
      if (!row.date) return true;
      if (timeFilter === "today") return row.date === todayStr;
      if (timeFilter === "week") return row.date >= weekRange.start && row.date <= weekRange.end;
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
    const mRows = (data.materialTransactions || []).filter(filterFn);
    const lRows = (data.laborLogs || []).filter(filterFn);

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

    // Grouped by supplier with a subtotal per supplier — mirrors how site
    // purchases are actually tracked (each supplier's deliveries reconciled
    // together), same shape as the Expense/Revenue breakdowns below.
    const materialsBySupplier = mRows.reduce((acc: Record<string, number>, row: any) => {
      const sup = row.supplier || "Unspecified supplier";
      acc[sup] = (acc[sup] || 0) + Number(row.total_cost ?? 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      budget: sum(bRows),
      revenue: sum(rRows),
      expenses: sum(eRows),
      owner: sum(oRows),
      invest: sum(siRows),
      materialsCost: mRows.reduce((s: number, x: any) => s + Number(x.total_cost ?? 0), 0),
      laborCost: lRows.reduce((s: number, x: any) => s + Number(x.total_cost ?? 0), 0),
      materialsBySupplier,
      expByCat,
      revBySource,
      shareholders: (data.shareholders || []).map((s: any) => ({
        ...s,
        invested: investByShareholder(s.id),
      })),
    };
  }, [data, timeFilter, customStart, customEnd]);

  const totalMoney = filteredFinancials.budget + filteredFinancials.revenue + filteredFinancials.invest;
  const deductMoney =
    filteredFinancials.expenses + filteredFinancials.owner + filteredFinancials.materialsCost + filteredFinancials.laborCost;
  const profit =
    filteredFinancials.revenue - filteredFinancials.expenses - filteredFinancials.materialsCost - filteredFinancials.laborCost;
  const net = totalMoney - deductMoney;

  function handlePrint() {
    window.print();
  }

  // RFC 4180 field escaping — without this, any project/category/shareholder
  // name containing a comma (or a quote, or a newline) silently shifts every
  // column after it, corrupting the file. Wrapping every field in quotes and
  // doubling internal quotes is the standard, always-safe way to avoid that.
  function csvField(value: unknown): string {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  function csvRow(cells: unknown[]): string {
    return cells.map(csvField).join(",");
  }

  function handleExportReportCSV() {
    if (!data) return;
    const rows: unknown[][] = [
      ["Bag E Rahmat Holdings ERP - Project Financial Summary"],
      ["Project", project?.name || ""],
      ["Generated Date", new Date().toLocaleDateString()],
      ["Time Filter", timeFilter],
      [],
      ["Financial Formulas Summary", "Amount (BDT)"],
      ["Total Money (Budget + Revenue + Invest)", totalMoney],
      ["Deduct Money (Expenses + Materials + Labor + Owner Payments)", deductMoney],
      ["Remaining Net Cash Balance", net],
      ["Gross Profit / Loss (Revenue - Expenses - Materials - Labor)", profit],
      [],
      ["Detailed Breakdown Metric", "Amount (BDT)"],
      ["Total Budget", filteredFinancials.budget],
      ["Total Revenue", filteredFinancials.revenue],
      ["Total Expenses", filteredFinancials.expenses],
      ["Total Materials Cost", filteredFinancials.materialsCost],
      ["Total Labor Cost", filteredFinancials.laborCost],
      ["Total Owner Payments", filteredFinancials.owner],
      ["Total Investments", filteredFinancials.invest],
      [],
      ["Expenses by Category", "Amount (BDT)"],
      ...(Object.keys(filteredFinancials.expByCat).length > 0
        ? Object.entries(filteredFinancials.expByCat).map(([cat, amt]) => [cat, amt])
        : [["No expenses in this period.", ""]]),
      [],
      ["Revenue by Source", "Amount (BDT)"],
      ...(Object.keys(filteredFinancials.revBySource).length > 0
        ? Object.entries(filteredFinancials.revBySource).map(([src, amt]) => [src, amt])
        : [["No revenue in this period.", ""]]),
      [],
      ["Materials by Supplier", "Subtotal (BDT)"],
      ...(Object.keys(filteredFinancials.materialsBySupplier).length > 0
        ? Object.entries(filteredFinancials.materialsBySupplier).map(([sup, amt]) => [sup, amt])
        : [["No material purchases in this period.", ""]]),
      [],
      ["Shareholder Report", "Ownership %", "Shares", "Total Invested (BDT)"],
      ...(filteredFinancials.shareholders.length > 0
        ? filteredFinancials.shareholders.map((s: any) => [
            s.name,
            Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0),
            Number(s.effective_share_count ?? s.share_count ?? 0),
            Number(s.invested),
          ])
        : [["No shareholders found.", "", "", ""]]),
    ];

    // Leading BOM tells Excel (the most common consumer of a downloaded CSV
    // on Windows) to read the file as UTF-8 instead of the system codepage —
    // without it, Bengali shareholder names and the ৳ currency symbol render
    // as mojibake even though the file itself is correctly encoded.
    const csvContent = "﻿" + rows.map(csvRow).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const safeName = (project?.name || "project").replace(/[^a-z0-9]+/gi, "_");
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial_report_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Financial report exported");
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function reportFileBaseName() {
    const safeName = (project?.name || "project").replace(/[^a-z0-9]+/gi, "_");
    return `financial_report_${safeName}_${new Date().toISOString().slice(0, 10)}`;
  }

  // Simple two-column "label, amount" table sections shared by both PDF and
  // Word export — kept as plain data here so each renderer just lays it out
  // in its own format instead of duplicating the numbers.
  function reportSections(): { title: string; rows: [string, string][] }[] {
    return [
      {
        title: "Financial Formula Summary",
        rows: [
          ["Total Money (Budget + Revenue + Invest)", fmtBDT(totalMoney)],
          ["Deduct Money (Expenses + Materials + Labor + Owner)", fmtBDT(deductMoney)],
          ["Remaining Net Cash Balance", fmtBDT(net)],
          ["Gross Profit / Loss", fmtBDT(profit)],
        ],
      },
      {
        title: "Detailed Breakdown",
        rows: [
          ["Total Budget", fmtBDT(filteredFinancials.budget)],
          ["Total Revenue", fmtBDT(filteredFinancials.revenue)],
          ["Total Expenses", fmtBDT(filteredFinancials.expenses)],
          ["Total Materials Cost", fmtBDT(filteredFinancials.materialsCost)],
          ["Total Labor Cost", fmtBDT(filteredFinancials.laborCost)],
          ["Total Owner Payments", fmtBDT(filteredFinancials.owner)],
          ["Total Investments", fmtBDT(filteredFinancials.invest)],
        ],
      },
      {
        title: "Expenses by Category",
        rows:
          Object.keys(filteredFinancials.expByCat).length > 0
            ? Object.entries(filteredFinancials.expByCat).map(([k, v]) => [k, fmtBDT(Number(v))] as [string, string])
            : [["No expenses in this period.", ""]],
      },
      {
        title: "Revenue by Source",
        rows:
          Object.keys(filteredFinancials.revBySource).length > 0
            ? Object.entries(filteredFinancials.revBySource).map(([k, v]) => [k, fmtBDT(Number(v))] as [string, string])
            : [["No revenue in this period.", ""]],
      },
      {
        title: "Materials by Supplier",
        rows:
          Object.keys(filteredFinancials.materialsBySupplier).length > 0
            ? Object.entries(filteredFinancials.materialsBySupplier).map(([k, v]) => [k, fmtBDT(Number(v))] as [string, string])
            : [["No material purchases in this period.", ""]],
      },
    ];
  }

  function shareholderRows(): [string, string, string][] {
    if (filteredFinancials.shareholders.length === 0) return [["No shareholders found.", "", ""]];
    return filteredFinancials.shareholders.map((s: any) => {
      const pct = Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0);
      const count = Number(s.effective_share_count ?? s.share_count ?? 0);
      return [s.name, count > 0 ? `${pct}% (${count} shares)` : `${pct}%`, fmtBDT(Number(s.invested))];
    });
  }

  function handleExportPDF() {
    if (!data) return;
    const doc = new jsPDF();
    const marginX = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 18;

    doc.setFontSize(16);
    doc.text(reportAppName, marginX, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(`${reportAppSubtitle} — Financial Report`, marginX, y);
    y += 6;
    doc.setFontSize(11);
    doc.text(project?.name || "", marginX, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Period: ${PERIOD_LABELS[timeFilter]}   ·   Generated: ${new Date().toLocaleDateString()}`, marginX, y);
    doc.setTextColor(0);
    y += 6;

    for (const section of reportSections()) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 18;
      }
      autoTable(doc, {
        startY: y,
        head: [[section.title, "Amount (BDT)"]],
        body: section.rows,
        theme: "grid",
        headStyles: { fillColor: [180, 140, 40] },
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 9 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (y > pageHeight - 40) {
      doc.addPage();
      y = 18;
    }
    autoTable(doc, {
      startY: y,
      head: [["Shareholder", "Ownership", "Total Invested"]],
      body: shareholderRows(),
      theme: "grid",
      headStyles: { fillColor: [180, 140, 40] },
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9 },
    });

    doc.save(`${reportFileBaseName()}.pdf`);
    toast.success("PDF report exported");
  }

  async function handleExportDOCX() {
    if (!data) return;

    const sectionBlocks = reportSections().flatMap((section) => [
      new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }),
      new DocxTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: section.rows.map(
          ([label, amount]) =>
            new TableRow({
              children: [
                new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph(label)] }),
                new TableCell({
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: amount, alignment: AlignmentType.RIGHT })],
                }),
              ],
            })
        ),
      }),
    ]);

    const shRows = shareholderRows();
    const shareholderTable = new DocxTable({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Shareholder", "Ownership", "Total Invested"].map(
            (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
          ),
        }),
        ...shRows.map(
          (r) =>
            new TableRow({
              children: r.map((cell, i) => new TableCell({ children: [new Paragraph({ text: cell, alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT })] })),
            })
        ),
      ],
    });

    const docx = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: reportAppName, heading: HeadingLevel.TITLE }),
            new Paragraph({ text: `${reportAppSubtitle} — Financial Report`, spacing: { after: 120 } }),
            new Paragraph({ text: project?.name || "", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              text: `Period: ${PERIOD_LABELS[timeFilter]}   ·   Generated: ${new Date().toLocaleDateString()}`,
              spacing: { after: 200 },
            }),
            ...sectionBlocks,
            new Paragraph({ text: "Shareholder Report", heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }),
            shareholderTable,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(docx);
    downloadBlob(blob, `${reportFileBaseName()}.docx`);
    toast.success("Word report exported");
  }

  return (
    <div className="space-y-10 print:space-y-4">
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
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportReportCSV}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-gold" /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-gold" /> PDF
          </button>
          <button
            onClick={handleExportDOCX}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <FileType className="h-3.5 w-3.5 text-gold" /> Word
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Printable Letterhead — matches the company's actual letterhead
          design: logo + bold rule at top, a faded watermark of the logo mark
          centered on the page, a gray/gold decorative corner, and an address
          strip at the bottom. The watermark/corner/footer use fixed
          positioning specifically so they repeat on every printed page (not
          just page 1) if a report ever runs long enough to spill onto a
          second page — standard letterhead behavior, not a one-off header. */}
      <div className="hidden print:block">
        <img
          src="/storage/uploads/watermark_r_mark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-[38%] w-56 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
        />
        <div
          className="pointer-events-none fixed bottom-0 right-0 h-48 w-48"
          style={{
            background: "linear-gradient(135deg, transparent 45%, #9a9a9a 45%)",
          }}
        />
        <div
          className="pointer-events-none fixed bottom-10 right-10 h-6 w-12"
          style={{ background: "linear-gradient(135deg, #d4af37, #f2d576)" }}
        />
        <div className="fixed bottom-6 left-8 text-[9px] leading-relaxed text-black">
          <p>53/2, D.I.T Extention Road, Fakirapool/Naya Paltan, Dhaka-1000.</p>
          <p>info@brahmatholdings.com, +8801898799700</p>
        </div>
      </div>

      {/* Printable Heading — uses the actual configured logo/app name from
          Admin > Settings (same source AppShell's header reads from) rather
          than a hardcoded company name, so a white-label deployment or a
          simple rebrand doesn't leave the old name on every printed report. */}
      <div className="hidden print:block mb-4 border-b-2 border-black pb-3">
        {reportAppLogo ? (
          <img src={reportAppLogo} alt={reportAppName} className="mb-1 h-10 max-w-[240px] object-contain" />
        ) : (
          <h1 className="text-2xl font-bold text-black">
            {reportAppName} <span className="font-medium text-black">{reportAppSubtitle}</span>
          </h1>
        )}
        <p className="text-sm text-black">Financial & Activity Report for: {project?.name}</p>
        <p className="mt-0.5 text-xs text-black">Date Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold print:mb-2 print:text-base">Financial Formula Summary</h2>
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading report data...</div>
        ) : (
          // md: alone isn't reliable here — a real print engine's usable page
          // width (page size minus margins) commonly lands just under the md
          // breakpoint, so without print:grid-cols-4 this silently falls back
          // to one column on paper even though it's a tidy 4-across on screen.
          <div className="grid gap-4 md:grid-cols-4 print:grid-cols-4 print:gap-2">
            <StatCard
              label="Total Money (Budget+Rev+Invest)"
              value={fmtBDT(totalMoney)}
              accent="green"
            />
            <StatCard
              label="Deduct Money (Exp+Materials+Labor+Owner)"
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
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:gap-2">
        <div className="noir-panel p-5 overflow-x-auto no-scrollbar print:p-3">
          <h3 className="mb-3 font-display text-lg font-semibold print:mb-1 print:text-sm">Expenses by Category</h3>
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

        <div className="noir-panel p-5 overflow-x-auto no-scrollbar print:p-3">
          <h3 className="mb-3 font-display text-lg font-semibold print:mb-1 print:text-sm">Revenue by Source</h3>
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

        <div className="noir-panel p-5 overflow-x-auto no-scrollbar print:p-3">
          <h3 className="mb-3 font-display text-lg font-semibold print:mb-1 print:text-sm">Materials by Supplier</h3>
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(filteredFinancials.materialsBySupplier).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                    No material purchases in this period.
                  </td>
                </tr>
              ) : (
                Object.entries(filteredFinancials.materialsBySupplier).map(([sup, amt]) => (
                  <tr key={sup} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{sup}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtBDT(Number(amt))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold print:mb-2 print:text-base">Shareholder Report</h2>
        {filteredFinancials.shareholders.length === 0 ? (
          <div className="noir-panel px-4 py-10 text-center text-muted-foreground">
            No shareholders found.
          </div>
        ) : (
          <>
            {/* Mobile / tablet: card list. Hidden on print — the table below
                is far more compact on paper and is forced visible there
                regardless of the lg: breakpoint (see its print:block). */}
            <div className="grid gap-3 lg:hidden print:hidden">
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

            {/* Desktop: table — also the print layout (print:block forces it
                on even when the print engine's usable width lands under the
                lg breakpoint, which is the common case on a real page). */}
            <div className="noir-panel hidden overflow-hidden lg:block print:block">
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
