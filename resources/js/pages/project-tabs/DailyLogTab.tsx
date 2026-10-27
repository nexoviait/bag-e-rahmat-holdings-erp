import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { DatePicker } from "@/components/DatePicker";
import { fmtBDT } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import { Loader2, Plus, X, AlertTriangle, AlertCircle, Trash2, Package, Search, Paperclip, Edit2, FileBarChart, Calendar, Download, ArrowLeft, FileText } from "lucide-react";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";
import { pickValidatedFile } from "@/lib/fileValidation";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Mirrors every receipt/attachment upload rule on this tab — both the
// material attachment and the material transaction receipt go through
// MaterialController/MaterialTransactionController, which both validate
// 'jpg'/'jpeg'/'png'/'pdf' up to 10MB (max:10240).
const RECEIPT_LIKE_RULES = { extensions: ["jpg", "jpeg", "png", "pdf"], maxBytes: 10 * 1024 * 1024 };

// Same shape as Laravel's own validation error bag ({field: [messages]}) so
// a backend 422 response can be dropped straight into this state — see
// DocumentsTab.tsx, which established this pattern first.
type FieldErrors = Record<string, string[]>;

// `.toISOString()` converts to UTC first — in a positive-UTC-offset timezone
// (e.g. Bangladesh, UTC+6) that silently rewinds local midnight into the
// previous UTC day, so every "YYYY-MM-DD" derived that way (today's date,
// and any week/month boundary below) could land one day early. This reads
// the Date object's own local year/month/day instead, never touching UTC.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return localDateStr(new Date());
}

const inputCls =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_20%,transparent)]";

// Every modal on this tab validates on submit and shows the result here,
// under the field, instead of relying on the browser's native `required`
// popup — those can't be styled, don't match the app's dark theme, and (per
// SelectWithCustom below) were previously firing even for fields the backend
// doesn't actually require.
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}

// Standard construction-material units — covers the metric/count units used
// across the app plus the local units (Goj, Suta) that already show up in the
// user's own purchase records, with a custom-unit escape hatch for anything
// else, same "select, or type your own" pattern as FinancialModule's category/
// source fields.
const UNIT_OPTIONS = ["Bag", "Ton", "Kg", "CFT", "Sft", "Rft", "Piece", "Roll", "Liter", "Set", "Lot", "Truck", "Goj", "Suta"];

/** A dropdown of standard options with a "+ Add custom" escape hatch — used
 * for Unit, Expense Category and Revenue Source alike. Never
 * uses the native HTML `required` attribute — that fired its own unstyled
 * browser popup even for Category/Source, which are actually nullable on
 * FinancialController's own validation. Whether a caller's field is really
 * required is entirely up to that caller's own `validate()`, surfaced here
 * via the optional `error` prop instead. */
function SelectWithCustom({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  error?: string;
}) {
  const [custom, setCustom] = useState(value !== "" && !options.includes(value));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            setCustom((v) => !v);
            onChange("");
          }}
          className="text-[11px] font-medium text-gold hover:underline cursor-pointer"
        >
          {custom ? "← Select from list" : "+ Add custom"}
        </button>
      </div>
      {custom ? (
        <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Type a ${label.toLowerCase()}`} />
      ) : (
        <select
          className={inputCls}
          value={value}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setCustom(true);
              onChange("");
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">-- Select {label.toLowerCase()} --</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__custom__">➕ Add custom...</option>
        </select>
      )}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// "Smart" in the sense that matters for a materials list: word-order- and
// field-order-independent. Every space-separated term in the query must
// appear SOMEWHERE across the given fields — so "sand balu" finds "Sand
// (Astor balu)" even though a plain substring search for that exact phrase
// wouldn't, and searching a supplier or work-item tag finds the same
// transaction a material-name search would.
function smartMatch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

export function DailyLogTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");
  // Which of the three daily-log sections is showing — only one at a time,
  // picked from the dropdown next to the date filter. Material In/Out is the
  // default since it's what this tab is opened for most often.
  const [view, setView] = useState<"materials" | "labor" | "stock" | "timeline">("materials");
  // Daily (the original single-date behavior) vs. Weekly/Monthly (the week or
  // month containing `date`) vs. Custom (an explicit start/end range) — lets
  // this page answer "what happened this week/month" without going through
  // the separate Report view just to see it on screen.
  const [periodMode, setPeriodMode] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [activeDialog, setActiveDialog] = useState<"material" | "transaction" | "labor" | null>(null);
  const [showReport, setShowReport] = useState(false);
  // The row being edited, if any — passed as `initialData` to whichever
  // modal is open. null means "add" mode for that modal.
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editingLabor, setEditingLabor] = useState<any | null>(null);

  const canViewMaterials = useHasPermission("materials.view");
  const canCreateMaterials = useHasPermission("materials.create");
  const canEditMaterials = useHasPermission("materials.edit");
  const canDeleteMaterials = useHasPermission("materials.delete");
  const canViewLabor = useHasPermission("labor.view");
  const canCreateLabor = useHasPermission("labor.create");
  const canEditLabor = useHasPermission("labor.edit");
  const canDeleteLabor = useHasPermission("labor.delete");
  const receiptPreview = useReceiptPreview();

  // Parsed manually (not `new Date(date)`) so this stays in local time —
  // parsing a bare "YYYY-MM-DD" string is treated as UTC midnight by JS and
  // can land on the wrong day once shifted to a negative-UTC-offset locale.
  const { periodLabel, apiDateFrom, apiDateTo } = useMemo(() => {
    // The date picker's own "X"/Clear control can set `date` (or
    // customStart/customEnd) to "" — without this fallback that produced an
    // Invalid Date, which formatted as "NaN-NaN-NaN" and sent a garbage
    // `date` to the API (422 → "Failed to load the daily summary").
    const safeDate = date || todayStr();
    if (periodMode === "weekly") {
      const [y, m, d] = safeDate.split("-").map(Number);
      const anchor = new Date(y, m - 1, d);
      const day = anchor.getDay();
      const monday = new Date(anchor);
      monday.setDate(anchor.getDate() + (day === 0 ? -6 : 1 - day));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const from = localDateStr(monday);
      const to = localDateStr(sunday);
      return { periodFrom: from, periodTo: to, periodLabel: `${from} to ${to}`, apiDateFrom: from, apiDateTo: to };
    }
    if (periodMode === "monthly") {
      const [y, m] = safeDate.split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      const from = localDateStr(first);
      const to = localDateStr(last);
      return { periodFrom: from, periodTo: to, periodLabel: `${from} to ${to}`, apiDateFrom: from, apiDateTo: to };
    }
    if (periodMode === "custom") {
      const from = customStart || safeDate;
      const to = customEnd || safeDate;
      return { periodFrom: from, periodTo: to, periodLabel: `${from} to ${to}`, apiDateFrom: from, apiDateTo: to };
    }
    // daily — apiDateTo stays undefined so the API calls below are byte-for-byte
    // what they were before periodMode existed (no date_to param at all).
    return { periodFrom: safeDate, periodTo: safeDate, periodLabel: safeDate, apiDateFrom: safeDate, apiDateTo: undefined as string | undefined };
  }, [periodMode, date, customStart, customEnd]);

  const materialsQuery = useQuery({
    queryKey: ["site-materials", projectId],
    enabled: canViewMaterials,
    queryFn: async () => {
      const res = await api.get(`/materials?project_id=${projectId}`);
      return res.data as any[];
    },
  });

  // Raw (unformatted) rows for this date — used for the Material In/Out and
  // Labor sections since editing needs the real fields (material_id, type,
  // quantity…), not the display-formatted strings the merged timeline below
  // builds for its single combined feed.
  const transactionsQuery = useQuery({
    queryKey: ["site-material-transactions", projectId, apiDateFrom, apiDateTo],
    enabled: canViewMaterials,
    queryFn: async () => {
      const dateToParam = apiDateTo ? `&date_to=${apiDateTo}` : "";
      const res = await api.get(`/material-transactions?project_id=${projectId}&date=${apiDateFrom}${dateToParam}`);
      return res.data as any[];
    },
  });

  const laborLogsQuery = useQuery({
    queryKey: ["site-labor-logs", projectId, apiDateFrom, apiDateTo],
    enabled: canViewLabor,
    queryFn: async () => {
      const dateToParam = apiDateTo ? `&date_to=${apiDateTo}` : "";
      const res = await api.get(`/labor-logs?project_id=${projectId}&date=${apiDateFrom}${dateToParam}`);
      return res.data as any[];
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["site-daily-summary", projectId, apiDateFrom, apiDateTo],
    queryFn: async () => {
      const dateToParam = apiDateTo ? `&date_to=${apiDateTo}` : "";
      const res = await api.get(`/projects/${projectId}/daily-summary?date=${apiDateFrom}${dateToParam}`);
      return res.data;
    },
  });

  const timeline: any[] = summaryQuery.data?.timeline ?? [];
  const materialRows = transactionsQuery.data ?? [];
  const laborRows = laborLogsQuery.data ?? [];

  const filteredMaterials = useMemo(
    () => (materialsQuery.data ?? []).filter((m: any) => smartMatch(search, m.name, m.unit)),
    [materialsQuery.data, search]
  );
  const filteredMaterialRows = useMemo(
    () => materialRows.filter((r: any) => smartMatch(search, r.material_name, r.supplier, r.used_for, r.notes)),
    [materialRows, search]
  );

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["site-materials", projectId] });
    qc.invalidateQueries({ queryKey: ["site-material-transactions", projectId, date] });
    qc.invalidateQueries({ queryKey: ["site-labor-logs", projectId, date] });
    qc.invalidateQueries({ queryKey: ["site-daily-summary", projectId, date] });
  }

  const deleteMaterial = useMutation({
    mutationFn: async (id: number) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      toast.success("Material deleted");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: number) => api.delete(`/material-transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const deleteLabor = useMutation({
    mutationFn: async (id: number) => api.delete(`/labor-logs/${id}`),
    onSuccess: () => {
      toast.success("Labor entry deleted");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  // A full page within this tab, not a modal on top of it — swaps out the
  // entire Daily Log body for the report view instead of overlaying it.
  if (showReport) {
    return <DailyLogReportView projectId={projectId} onBack={() => setShowReport(false)} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-gold" />
          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as typeof periodMode)}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_20%,transparent)]"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {periodMode === "custom" ? (
            <div className="flex items-center gap-2">
              <div className="w-40">
                {/* Clearing never leaves this blank — an unset start/end
                    doesn't mean anything on this page, so it just falls back
                    to today instead of producing an Invalid Date downstream. */}
                <DatePicker value={customStart} onChange={(v) => setCustomStart(v || todayStr())} placeholder="Start date" />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <div className="w-40">
                <DatePicker value={customEnd} onChange={(v) => setCustomEnd(v || todayStr())} placeholder="End date" />
              </div>
            </div>
          ) : (
            <div className="w-48">
              <DatePicker value={date} onChange={(v) => setDate(v || todayStr())} placeholder="Select date" />
            </div>
          )}
          <span className="mx-1 hidden h-6 w-px shrink-0 bg-border/60 sm:block" />
          <select
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_20%,transparent)]"
          >
            <option value="materials">Material In/Out</option>
            <option value="labor">Labor</option>
            <option value="stock">Stock Levels</option>
            <option value="timeline">Full Timeline</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Quick-add Expense/Revenue removed from Daily Log entirely — the
              dedicated Revenue/Expenses tabs are the actual home for that
              data (same reasoning as removing the standalone "+ Material"
              button above); this tab now only creates the things that are
              genuinely Daily Log's own — materials, material movement, labor. */}
          {/* Standalone "+ Material" (create a bare master record with no
              transaction) removed — "+ Material In/Out" already has its own
              "+ This is a new item" inline path, which is what everyone
              actually used this for. The plain edit pencil in the Stock
              Levels table below still opens the same modal for existing
              materials (reorder level, attachment, etc.). */}
          {canCreateMaterials && (
            <button
              onClick={() => {
                setEditingTransaction(null);
                setActiveDialog("transaction");
              }}
              className="pill-btn-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Material In/Out
            </button>
          )}
          {canCreateLabor && (
            <button
              onClick={() => {
                setEditingLabor(null);
                setActiveDialog("labor");
              }}
              className="pill-btn-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Labor
            </button>
          )}
          {/* Read-only, so gated on view rather than create — scoped
              deliberately to just Material In/Out, Labor and Stock (see
              DailyLogReportView's own docblock for why this stays separate
              from the project-wide Reports tab). */}
          {(canViewMaterials || canViewLabor) && (
            <button onClick={() => setShowReport(true)} className="pill-btn">
              <FileBarChart className="h-3.5 w-3.5" /> Report
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard label={periodMode === "daily" ? "Expenses (this day)" : "Expenses (this period)"} value={fmtBDT(summaryQuery.data?.expenses ?? 0)} accent="red" />
        <StatCard label={periodMode === "daily" ? "Revenue (this day)" : "Revenue (this period)"} value={fmtBDT(summaryQuery.data?.revenue ?? 0)} accent="green" />
        <StatCard label="Materials Cost" value={fmtBDT(summaryQuery.data?.materialsCost ?? 0)} accent="red" />
        <StatCard label="Labor Cost" value={fmtBDT(summaryQuery.data?.laborCost ?? 0)} accent="red" />
        <StatCard label={periodMode === "daily" ? "Net (this day)" : "Net (this period)"} value={fmtBDT(summaryQuery.data?.net ?? 0)} accent="gold" />
      </div>

      {/* Only the section picked from the dropdown above renders — Material
          In/Out, then Labor, then the (less frequently touched) Stock Levels
          reference table were previously all shown stacked at once; the
          dropdown now keeps the page to one section at a time. Search stays
          a single shared input here since it still filters both Material
          In/Out and Stock Levels. */}
      {view === "materials" && canViewMaterials && (
        <div className="noir-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <h3 className="font-display text-lg font-semibold">Material In/Out — {periodLabel}</h3>
            <div className="relative w-full max-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search materials, supplier, work item…"
                className="w-full rounded-md border border-border bg-input py-1.5 pl-8 pr-3 text-xs text-foreground outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="px-5 py-4">
            {materialRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No material movement recorded for this {periodMode === "daily" ? "date" : "period"}.</div>
            ) : filteredMaterialRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries match "{search}".</div>
            ) : (
              <div className="space-y-2">
                {filteredMaterialRows.map((r: any) => {
                  const tag = r.type === "in" && r.supplier ? `Supplier: ${r.supplier}` : null;
                  const workItem = r.used_for ? `Work item: ${r.used_for}` : null;
                  const transport = r.transportation_cost != null ? `Transport: ${fmtBDT(r.transportation_cost)}` : null;
                  const carrying = r.carrying_cost != null ? `Carrying: ${fmtBDT(r.carrying_cost)}` : null;
                  const note = r.notes ? `Note: ${r.notes}` : null;
                  const detail = [tag, workItem, transport, carrying, note].filter(Boolean).join(" · ");
                  const qtyLabel = r.quantity != null ? `${r.quantity} ${r.unit} of ` : "";
                  // All-in total — base cost plus transportation/carrying,
                  // same figure the Materials Cost stat card and Report view
                  // already use, so this row's number actually matches them
                  // instead of silently under-counting by whatever got spent
                  // getting the material to site.
                  const hasAnyCost = r.total_cost != null || r.transportation_cost != null || r.carrying_cost != null;
                  const allInTotal = Number(r.total_cost ?? 0) + Number(r.transportation_cost ?? 0) + Number(r.carrying_cost ?? 0);
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
                        {periodMode !== "daily" && (
                          <span className="mr-2 rounded-full bg-surface-1 px-2 py-0.5 text-[10px] text-muted-foreground">{r.date}</span>
                        )}
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            r.type === "in"
                              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {r.type === "in" ? "Material In" : "Material Out"}
                        </span>
                        <span className="text-sm">
                          {qtyLabel}"{r.material_name}"
                        </span>
                        {detail && <span className="ml-2 text-xs text-muted-foreground">({detail})</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {r.receipt_path && (
                          <button
                            onClick={() => receiptPreview.open(`/material-transactions/${r.id}/receipt`)}
                            title="View receipt"
                            className="text-muted-foreground hover:text-gold cursor-pointer"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                        )}
                        {hasAnyCost && (
                          <div className="text-right">
                            {r.total_cost != null && (r.transportation_cost != null || r.carrying_cost != null) && (
                              <div className="text-[11px] text-muted-foreground">
                                Material: <span className="text-foreground">{fmtBDT(r.total_cost)}</span>
                              </div>
                            )}
                            <div className="text-sm font-medium">
                              {r.total_cost != null && (r.transportation_cost != null || r.carrying_cost != null) ? (
                                <>
                                  <span className="text-xs font-normal text-muted-foreground">Total: </span>
                                  <span className="text-gold">{fmtBDT(allInTotal)}</span>
                                </>
                              ) : (
                                fmtBDT(allInTotal)
                              )}
                            </div>
                          </div>
                        )}
                        {canEditMaterials && (
                          <button
                            onClick={() => {
                              setEditingTransaction(r);
                              setActiveDialog("transaction");
                            }}
                            className="text-muted-foreground hover:text-gold cursor-pointer"
                            aria-label="Edit transaction"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteMaterials && (
                          <button
                            onClick={() => {
                              const kind = r.type === "in" ? "Material In" : "Material Out";
                              if (confirm(`Delete this ${kind} entry for "${r.material_name}"? This cannot be undone.`)) {
                                deleteTransaction.mutate(r.id);
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "labor" && canViewLabor && (
        <div className="noir-panel overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <h3 className="font-display text-lg font-semibold">Labor — {periodLabel}</h3>
          </div>
          <div className="px-5 py-4">
            {laborRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No labor logged for this {periodMode === "daily" ? "date" : "period"}.</div>
            ) : (
              <div className="space-y-2">
                {laborRows.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      {periodMode !== "daily" && (
                        <span className="mr-2 rounded-full bg-surface-1 px-2 py-0.5 text-[10px] text-muted-foreground">{r.date}</span>
                      )}
                      <span className="text-sm">{r.labor_type ? `${r.headcount} × ${r.labor_type}` : `${r.headcount} worker${r.headcount === 1 ? "" : "s"}`}</span>
                      {r.notes && <span className="ml-2 text-xs text-muted-foreground">({r.notes})</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium">{fmtBDT(r.total_cost)}</span>
                      {canEditLabor && (
                        <button
                          onClick={() => {
                            setEditingLabor(r);
                            setActiveDialog("labor");
                          }}
                          className="text-muted-foreground hover:text-gold cursor-pointer"
                          aria-label="Edit labor entry"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteLabor && (
                        <button
                          onClick={() => {
                            const label = r.labor_type ? `${r.headcount} × ${r.labor_type}` : `${r.headcount} worker(s)`;
                            if (confirm(`Delete this labor entry (${label})? This cannot be undone.`)) deleteLabor.mutate(r.id);
                          }}
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                          aria-label="Delete labor entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "stock" && canViewMaterials && (
        <div className="noir-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
            <Package className="h-4 w-4 text-gold" />
            <h3 className="font-display text-lg font-semibold">Stock Levels</h3>
          </div>
          {materialsQuery.isLoading ? (
            <div className="grid h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : (materialsQuery.data ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground">
              No materials added yet for this project.
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground">
              No materials match "{search}".
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Material</th>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3 text-right">Current Stock</th>
                    {(canEditMaterials || canDeleteMaterials) && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((m: any) => {
                    const low = m.reorder_level != null && Number(m.current_stock) <= Number(m.reorder_level);
                    return (
                      <tr key={m.id} className="border-b border-border/40 last:border-0">
                        <td className="px-5 py-3">{m.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{m.unit}</td>
                        <td className="px-5 py-3 text-right font-medium">
                          <span className={low ? "text-destructive" : ""}>{m.current_stock}</span>
                          {low && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-destructive">
                              <AlertTriangle className="h-3 w-3" /> Low
                            </span>
                          )}
                        </td>
                        {(canEditMaterials || canDeleteMaterials) && (
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {m.attachment_path && (
                                <button
                                  onClick={() => receiptPreview.open(`/materials/${m.id}/attachment`)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                                  aria-label="View material attachment"
                                  title="View attachment"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                              )}
                              {canEditMaterials && (
                                <button
                                  onClick={() => {
                                    setEditingMaterial(m);
                                    setActiveDialog("material");
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                                  aria-label="Edit material"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              {canDeleteMaterials && (
                                <button
                                  onClick={() => confirm(`Delete "${m.name}"? This also removes its In/Out history.`) && deleteMaterial.mutate(m.id)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                  aria-label="Delete material"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "timeline" && (
      <div className="noir-panel overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="font-display text-lg font-semibold">Full timeline — {periodLabel}</h3>
        </div>
        {summaryQuery.isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">Nothing recorded for this {periodMode === "daily" ? "date" : "period"} yet.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {timeline.map((r: any) => (
              <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  {periodMode !== "daily" && r.created_at && (
                    <span className="mr-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {String(r.created_at).slice(0, 10)}
                    </span>
                  )}
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      r.kind === "Revenue"
                        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : r.kind === "Expense" || r.kind === "Material Out"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-gold/15 text-gold"
                    }`}
                  >
                    {r.kind}
                  </span>
                  <span className="text-sm text-foreground">{r.label ?? r.description ?? "—"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.receipt_url && (
                    <button
                      onClick={() => receiptPreview.open(r.receipt_url)}
                      title="View receipt"
                      className="text-muted-foreground hover:text-gold cursor-pointer"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  )}
                  {r.amount != null && <span className="font-medium">{fmtBDT(r.amount)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {activeDialog === "material" && (
        <AddMaterialModal
          projectId={projectId}
          initialData={editingMaterial}
          onClose={() => {
            setActiveDialog(null);
            setEditingMaterial(null);
          }}
          onSaved={invalidateAll}
          onDelete={
            canDeleteMaterials && editingMaterial
              ? () => {
                  if (!confirm(`Delete "${editingMaterial.name}"? This also removes its In/Out history.`)) return;
                  deleteMaterial.mutate(editingMaterial.id, {
                    onSuccess: () => {
                      setActiveDialog(null);
                      setEditingMaterial(null);
                    },
                  });
                }
              : undefined
          }
          deleting={deleteMaterial.isPending}
        />
      )}
      {activeDialog === "transaction" && (
        <AddTransactionModal
          projectId={projectId}
          date={date}
          materials={materialsQuery.data ?? []}
          initialData={editingTransaction}
          onClose={() => {
            setActiveDialog(null);
            setEditingTransaction(null);
          }}
          onSaved={invalidateAll}
        />
      )}
      {activeDialog === "labor" && (
        <AddLaborModal
          projectId={projectId}
          date={date}
          initialData={editingLabor}
          onClose={() => {
            setActiveDialog(null);
            setEditingLabor(null);
          }}
          onSaved={invalidateAll}
        />
      )}
      {receiptPreview.preview && (
        <ReceiptPreviewModal
          url={receiptPreview.preview.url}
          mime={receiptPreview.preview.mime}
          onClose={receiptPreview.close}
        />
      )}
      <style>{`
        .pill-btn{display:inline-flex;align-items:center;gap:.375rem;border-radius:9999px;border:1px solid var(--border);background:var(--surface-2);padding:.4rem .9rem;font-size:.75rem;font-weight:500;color:var(--foreground);cursor:pointer;transition:border-color .15s}
        .pill-btn:hover{border-color:color-mix(in oklab,var(--gold) 50%,transparent)}
        .pill-btn-primary{display:inline-flex;align-items:center;gap:.375rem;border-radius:9999px;background:var(--primary);padding:.4rem 1rem;font-size:.75rem;font-weight:500;color:var(--primary-foreground);cursor:pointer;transition:opacity .15s}
        .pill-btn-primary:hover{opacity:.95}
      `}</style>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      {/* max-h + overflow-y-auto — the material-transaction form (quantity,
          rate, amount, transport, carrying, supplier, work item, receipt)
          is tall enough on a normal-height screen that its own Save button
          can end up clipped below the fold with no way to scroll to it. */}
      <div className="noir-panel flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddMaterialModal({
  projectId,
  initialData,
  onClose,
  onSaved,
  onDelete,
  deleting,
}: {
  projectId: string;
  initialData?: any | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [unit, setUnit] = useState(initialData?.unit ?? "");
  const [reorderLevel, setReorderLevel] = useState(initialData?.reorder_level != null ? String(initialData.reorder_level) : "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [attachment, setAttachment] = useState<File | null>(null);
  const attachmentPreview = useReceiptPreview();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = ["Material name is required."];
    if (!unit) errors.unit = ["Please select or enter a unit."];
    return errors;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        project_id: projectId,
        name,
        unit,
        reorder_level: reorderLevel || null,
        notes: notes || null,
      };
      const url = isEditing ? `/materials/${initialData.id}` : "/materials";

      if (!attachment) {
        if (isEditing) return api.put(url, payload);
        return api.post(url, payload);
      }

      // A file forces multipart — same PUT-with-`_method`-override pattern as
      // AddTransactionModal, since the shared `api` instance's default
      // Content-Type would otherwise JSON-stringify the FormData body.
      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v ?? ""));
      formData.append("attachment", attachment);
      if (isEditing) formData.append("_method", "PUT");
      return api.post(url, formData, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success(isEditing ? "Material updated" : "Material added");
      onSaved();
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as FieldErrors | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <ModalShell title={isEditing ? "Edit material" : "Add material"} onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validate();
          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
          }
          setFieldErrors({});
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <Field label="Material name" error={fieldErrors.name?.[0]}>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
            }}
            placeholder="e.g. Cement (OPC 52.5)"
          />
        </Field>
        <SelectWithCustom
          label="Unit"
          value={unit}
          onChange={(v) => {
            setUnit(v);
            if (fieldErrors.unit) setFieldErrors((p) => ({ ...p, unit: undefined }));
          }}
          options={UNIT_OPTIONS}
          error={fieldErrors.unit?.[0]}
        />
        <Field label="Reorder level (optional)">
          <input type="number" step="any" min="0" className={inputCls} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="Alert when stock falls below this" />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputCls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Attachment (optional — JPG, PNG or PDF)">
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setAttachment(pickValidatedFile(e.target, RECEIPT_LIKE_RULES))}
            className={`${inputCls} file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground`}
          />
          {initialData?.attachment_path && (
            <button
              type="button"
              onClick={() => attachmentPreview.open(`/materials/${initialData.id}/attachment`)}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gold hover:underline cursor-pointer"
            >
              <Paperclip className="h-3 w-3" /> View current attachment
            </button>
          )}
          {initialData?.attachment_path && (
            <p className="mt-1 text-[11px] text-muted-foreground">Choosing a new file replaces the current attachment.</p>
          )}
        </Field>
        <button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isEditing ? "Update material" : "Add material"}
        </button>
        {/* Same size/shape as the Update button above (just the app's
            standard destructive treatment) so delete reads as an equally
            real, equally tappable action instead of the small icon-only
            trash button in the list behind this modal — easy to miss and
            hard to hit precisely on a phone. */}
        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 py-2.5 font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60 cursor-pointer"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete material
          </button>
        )}
      </form>

      {attachmentPreview.preview && (
        <ReceiptPreviewModal
          url={attachmentPreview.preview.url}
          mime={attachmentPreview.preview.mime}
          onClose={attachmentPreview.close}
        />
      )}
    </ModalShell>
  );
}

function AddTransactionModal({
  projectId,
  date,
  materials,
  initialData,
  onClose,
  onSaved,
}: {
  projectId: string;
  date: string;
  materials: any[];
  initialData?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!initialData;
  // Defaults to whichever day the Daily Log page is currently viewing, but
  // stays independently editable here — lets you log a previous day's
  // purchase/usage without first changing the page's own date filter.
  const [entryDate, setEntryDate] = useState(initialData?.date ?? date);
  const [isNewMaterial, setIsNewMaterial] = useState(!isEditing && materials.length === 0);
  const [materialId, setMaterialId] = useState(initialData?.material_id ?? materials[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [type, setType] = useState<"in" | "out">(initialData?.type ?? "in");
  const [quantity, setQuantity] = useState(initialData?.quantity != null ? String(initialData.quantity) : "");
  const [unitPrice, setUnitPrice] = useState(initialData?.unit_price != null ? String(initialData.unit_price) : "");
  const [amount, setAmount] = useState(initialData?.total_cost != null ? String(initialData.total_cost) : "");
  const [amountTouched, setAmountTouched] = useState(isEditing);
  const [transportationCost, setTransportationCost] = useState(
    initialData?.transportation_cost != null ? String(initialData.transportation_cost) : ""
  );
  const [carryingCost, setCarryingCost] = useState(
    initialData?.carrying_cost != null ? String(initialData.carrying_cost) : ""
  );
  const [supplier, setSupplier] = useState(initialData?.supplier ?? "");
  const [usedFor, setUsedFor] = useState(initialData?.used_for ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptPreview = useReceiptPreview();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Caches the id of a material created via the "new item" branch below so a
  // retry (after this step succeeds but the transaction step that follows it
  // fails for some unrelated reason) reuses it instead of POSTing /materials
  // a second time with the same name — which used to hit the table's
  // unique(project_id, name) constraint and surface as a raw, confusing
  // "Failed to create material." Resets if the user actually changes what
  // they're naming, since that's genuinely a different item.
  const createdMaterialIdRef = useRef<number | null>(null);
  useEffect(() => {
    createdMaterialIdRef.current = null;
  }, [newName, newUnit]);

  // Convenience only — quantity×rate fills the Amount field, but the user's
  // own real purchase log shows the recorded amount doesn't always match that
  // exactly (rounding, negotiated lump prices), so it never overwrites a value
  // they've typed themselves. Disabled once editing, since the stored amount
  // is already the source of truth and shouldn't jump around as they tweak
  // quantity/rate on an existing row.
  function suggestedAmount() {
    if (isEditing) return "";
    const q = Number(quantity), r = Number(unitPrice);
    return q > 0 && r > 0 ? (q * r).toFixed(2) : "";
  }
  const displayAmount = amountTouched ? amount : amount || suggestedAmount();

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!entryDate) errors.entryDate = ["Date is required."];
    if (isNewMaterial) {
      if (!newName.trim()) errors.newName = ["Item name is required."];
      if (!newUnit) errors.newUnit = ["Please select or enter a unit."];
    } else if (!materialId) {
      errors.materialId = ["Please select an item."];
    }

    // Mirrors StoreMaterialTransactionRequest's own cross-field rule exactly
    // — a quantity, an amount, or both satisfy it. Previously this form
    // instead forced Amount via a native `required` attribute whenever type
    // was "in", which was stricter than the backend actually requires (a
    // quantity-only IN row is perfectly valid) and showed as an unstyled
    // browser popup rather than this inline message.
    const hasAmount = !!displayAmount;
    const hasQtyAndRate = !!quantity && !!unitPrice;
    const hasQtyOnly = !!quantity;
    if (!hasAmount && !hasQtyAndRate && !hasQtyOnly) {
      errors.quantity = ["Enter a quantity, an amount, or both."];
    }
    return errors;
  }

  const save = useMutation({
    mutationFn: async () => {
      let id = materialId;
      if (isNewMaterial) {
        if (createdMaterialIdRef.current) {
          id = createdMaterialIdRef.current;
        } else {
          const res = await api.post("/materials", { project_id: projectId, name: newName, unit: newUnit });
          id = res.data.id;
          createdMaterialIdRef.current = id;
        }
      }
      const payload: Record<string, any> = {
        project_id: projectId,
        material_id: id,
        type,
        date: entryDate,
        quantity: quantity || null,
        unit_price: type === "in" ? unitPrice || null : null,
        total_cost: displayAmount || null,
        transportation_cost: type === "in" ? transportationCost || null : null,
        carrying_cost: type === "in" ? carryingCost || null : null,
        supplier: type === "in" ? supplier || null : null,
        used_for: usedFor || null,
        notes: notes || null,
      };

      const url = isEditing ? `/material-transactions/${initialData.id}` : "/material-transactions";

      if (!receipt) {
        if (isEditing) return api.put(url, payload);
        return api.post(url, payload);
      }

      // A file forces multipart — the shared `api` instance defaults to
      // Content-Type: application/json, which would otherwise JSON-stringify
      // the FormData body and silently drop the actual file. PUT-with-multipart
      // is unreliable across browsers/proxies, so an edit goes through POST
      // with a `_method` override instead, same as FinancialModule.tsx.
      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v ?? ""));
      formData.append("receipt", receipt);
      if (isEditing) formData.append("_method", "PUT");
      return api.post(url, formData, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success(isEditing ? "Transaction updated" : "Transaction recorded");
      onSaved();
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as FieldErrors | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <ModalShell title={isEditing ? "Edit material transaction" : "Record material purchase / usage"} onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validate();
          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
          }
          setFieldErrors({});
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <Field label="Date" error={fieldErrors.entryDate?.[0]}>
          <DatePicker
            value={entryDate}
            onChange={(v) => {
              setEntryDate(v);
              if (fieldErrors.entryDate) setFieldErrors((p) => ({ ...p, entryDate: undefined }));
            }}
          />
        </Field>
        {isNewMaterial ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="New item name" error={fieldErrors.newName?.[0]}>
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (fieldErrors.newName) setFieldErrors((p) => ({ ...p, newName: undefined }));
                }}
                placeholder='e.g. Poli (20 goj)'
              />
            </Field>
            <SelectWithCustom
              label="Unit"
              value={newUnit}
              onChange={(v) => {
                setNewUnit(v);
                if (fieldErrors.newUnit) setFieldErrors((p) => ({ ...p, newUnit: undefined }));
              }}
              options={UNIT_OPTIONS}
              error={fieldErrors.newUnit?.[0]}
            />
          </div>
        ) : (
          <Field label="Item" error={fieldErrors.materialId?.[0]}>
            <select
              className={inputCls}
              value={materialId}
              onChange={(e) => {
                setMaterialId(e.target.value);
                if (fieldErrors.materialId) setFieldErrors((p) => ({ ...p, materialId: undefined }));
              }}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </Field>
        )}
        {!isEditing && materials.length > 0 && (
          <button
            type="button"
            onClick={() => setIsNewMaterial((v) => !v)}
            className="text-xs font-medium text-gold hover:underline cursor-pointer"
          >
            {isNewMaterial ? "← Choose an existing item instead" : "+ This is a new item"}
          </button>
        )}

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setType("in")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              type === "in" ? "bg-gold text-slate-950 font-bold" : "text-muted-foreground"
            }`}
          >
            Purchased (IN)
          </button>
          <button
            type="button"
            onClick={() => setType("out")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              type === "out" ? "bg-gold text-slate-950 font-bold" : "text-muted-foreground"
            }`}
          >
            Used (OUT)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity (optional)" error={fieldErrors.quantity?.[0]}>
            <input
              type="number"
              step="any"
              min="0"
              className={inputCls}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (fieldErrors.quantity) setFieldErrors((p) => ({ ...p, quantity: undefined }));
              }}
              placeholder="Leave blank if N/A"
            />
          </Field>
          {type === "in" && (
            <Field label="Rate / unit (optional)">
              <input type="number" step="any" min="0" className={inputCls} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </Field>
          )}
        </div>

        <Field label="Amount (BDT, optional if quantity is given)">
          <input
            type="number"
            step="any"
            min="0"
            className={inputCls}
            value={displayAmount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
              if (fieldErrors.quantity) setFieldErrors((p) => ({ ...p, quantity: undefined }));
            }}
            placeholder="Total amount for this row"
          />
        </Field>

        {type === "in" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Transportation cost (optional)">
              <input
                type="number"
                step="any"
                min="0"
                className={inputCls}
                value={transportationCost}
                onChange={(e) => setTransportationCost(e.target.value)}
                placeholder="Delivery / vehicle charge"
              />
            </Field>
            <Field label="Carrying cost (optional)">
              <input
                type="number"
                step="any"
                min="0"
                className={inputCls}
                value={carryingCost}
                onChange={(e) => setCarryingCost(e.target.value)}
                placeholder="Labor to carry it in"
              />
            </Field>
          </div>
        )}

        {type === "in" && (
          <Field label="Supplier (optional)">
            <input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
        )}
        <Field label="Work item / used for (optional)">
          <input className={inputCls} value={usedFor} onChange={(e) => setUsedFor(e.target.value)} placeholder='e.g. "Mat CC", 3rd floor slab' />
        </Field>

        <Field label="Notes / comment (optional)">
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else worth recording about this row"
          />
        </Field>

        <Field label="Receipt (optional — JPG, PNG or PDF)">
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setReceipt(pickValidatedFile(e.target, RECEIPT_LIKE_RULES))}
            className={`${inputCls} file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground`}
          />
          {initialData?.receipt_path && (
            <button
              type="button"
              onClick={() => receiptPreview.open(`/material-transactions/${initialData.id}/receipt`)}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gold hover:underline cursor-pointer"
            >
              <Paperclip className="h-3 w-3" /> View current receipt
            </button>
          )}
          {initialData?.receipt_path && (
            <p className="mt-1 text-[11px] text-muted-foreground">Choosing a new file replaces the current receipt.</p>
          )}
        </Field>

        <button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isEditing ? "Update transaction" : "Save"}
        </button>
      </form>

      {receiptPreview.preview && (
        <ReceiptPreviewModal
          url={receiptPreview.preview.url}
          mime={receiptPreview.preview.mime}
          onClose={receiptPreview.close}
        />
      )}
    </ModalShell>
  );
}

function AddLaborModal({
  projectId,
  date,
  initialData,
  onClose,
  onSaved,
}: {
  projectId: string;
  date: string;
  initialData?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!initialData;
  const [entryDate, setEntryDate] = useState(initialData?.date ?? date);
  const [headcount, setHeadcount] = useState(initialData?.headcount != null ? String(initialData.headcount) : "");
  const [wageRate, setWageRate] = useState(initialData?.wage_rate != null ? String(initialData.wage_rate) : "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const autoTotal = (Number(headcount) || 0) * (Number(wageRate) || 0);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!entryDate) errors.entryDate = ["Date is required."];
    if (!headcount || Number(headcount) < 1) errors.headcount = ["Headcount must be at least 1."];
    return errors;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        date: entryDate,
        headcount,
        wage_rate: wageRate || null,
        notes: notes || null,
      };
      if (isEditing) return api.put(`/labor-logs/${initialData.id}`, payload);
      return api.post("/labor-logs", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Labor entry updated" : "Labor logged");
      onSaved();
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as FieldErrors | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <ModalShell title={isEditing ? "Edit labor entry" : "Log daily labor"} onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validate();
          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
          }
          setFieldErrors({});
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <Field label="Date" error={fieldErrors.entryDate?.[0]}>
          <DatePicker
            value={entryDate}
            onChange={(v) => {
              setEntryDate(v);
              if (fieldErrors.entryDate) setFieldErrors((p) => ({ ...p, entryDate: undefined }));
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Headcount" error={fieldErrors.headcount?.[0]}>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={headcount}
              onChange={(e) => {
                setHeadcount(e.target.value);
                if (fieldErrors.headcount) setFieldErrors((p) => ({ ...p, headcount: undefined }));
              }}
            />
          </Field>
          <Field label="Wage rate / person (BDT)">
            <input type="number" step="any" min="0" className={inputCls} value={wageRate} onChange={(e) => setWageRate(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
          Auto-computed total: <span className="font-medium text-foreground">{fmtBDT(autoTotal)}</span>
        </div>
        <Field label="Notes (optional)">
          <textarea className={`${inputCls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isEditing ? "Update labor entry" : "Save"}
        </button>
      </form>
    </ModalShell>
  );
}

type DailyLogReportFilter = "today" | "week" | "month" | "year" | "all" | "custom";

const DAILY_LOG_REPORT_FILTER_LABELS: Record<DailyLogReportFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

// jsPDF's built-in fonts only cover WinAnsi (Latin-1) — the ৳ glyph used by
// fmtBDT() renders as mangled, oddly-spaced garbage in a PDF context (fine
// everywhere else since the browser renders it natively). PDFs use this
// ASCII-safe "Tk" prefix instead.
function pdfBDT(amount: number | null | undefined): string {
  const n = amount == null || isNaN(Number(amount)) ? 0 : Number(amount);
  return "Tk " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Summing many transaction quantities (e.g. 0.1 + 0.2 across several
// purchases) accumulates binary floating-point error — displayed raw this
// showed as "200.57999999999998". Rounded to 3 decimals (enough for any
// real unit fraction used here) and printed as a plain number, which drops
// trailing zeros on its own (200.58, not 200.580).
function fmtQty(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

// Same-origin logo URL -> data URI, since jsPDF's addImage() needs the raw
// image bytes up front rather than a URL it can fetch itself.
async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}

// jsPDF's built-in fonts (helvetica etc.) only cover WinAnsi/Latin-1 — any
// Bangla text (a supplier name, material name, note...) silently renders as
// mangled mojibake instead of failing loudly, since each UTF-8 byte gets
// drawn as its own Latin-1 glyph. Noto Sans Bengali (SIL Open Font License,
// public/fonts/NotoSansBengali.ttf) covers Bengali script and, usefully,
// renders Latin text cleanly too — so once embedded it replaces helvetica
// everywhere in this PDF rather than needing per-cell script detection.
// It's a variable font (wdth,wght axes); jsPDF only resolves its default
// (Regular) instance, so this is registered as both "normal" and "bold" to
// keep autoTable's bold header/footer styling from erroring on a missing
// font variant — bold text renders at regular weight, which is a fine
// trade-off next to the alternative of garbled Bangla.
let cachedBengaliFontBase64: string | null = null;
async function loadBengaliFontBase64(): Promise<string | null> {
  if (cachedBengaliFontBase64) return cachedBengaliFontBase64;
  try {
    const res = await fetch("/fonts/NotoSansBengali.ttf");
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // addFileToVFS wants the raw base64 payload, not the data: URL prefix.
    cachedBengaliFontBase64 = dataUrl.split(",")[1] ?? null;
    return cachedBengaliFontBase64;
  } catch {
    return null;
  }
}

const VIEW_LABELS = {
  materials: "Material In/Out",
  labor: "Labor",
  stock: "Stock Levels",
} as const;

/**
 * Deliberately its own report, separate from the project-wide Reports tab
 * (which is Shareholder Report only — see ReportsTab.tsx's own docblock).
 * Daily Log has its own calculation: Material In/Out cost + Labor cost +
 * current Stock, nothing from Expenses/Revenue/Shareholders. Fetches ALL of
 * the project's transactions/labor logs (not just the selected day — both
 * endpoints treat `date` as optional) and filters client-side by period,
 * same pattern as ReportsTab.tsx used before it was simplified.
 */
function DailyLogReportView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [timeFilter, setTimeFilter] = useState<DailyLogReportFilter>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  // Same one-section-at-a-time dropdown as the main Daily Log page, so this
  // report view isn't the only place still showing everything stacked.
  const [view, setView] = useState<"materials" | "labor" | "stock">("materials");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data,
  });
  // Same queryKey AppShell/ReportsTab use for the app header, so this reuses
  // that cached fetch instead of firing a second /settings request.
  const settingsQuery = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const reportAppName = settingsQuery.data?.app_name ?? "Bag E Rahmat";
  const reportAppSubtitle = settingsQuery.data?.app_subtitle ?? "Holdings ERP";
  const reportAppLogo = settingsQuery.data?.app_logo ?? null;

  const materialsQuery = useQuery({
    queryKey: ["site-materials", projectId],
    queryFn: async () => (await api.get(`/materials?project_id=${projectId}`)).data as any[],
  });
  const transactionsQuery = useQuery({
    queryKey: ["site-material-transactions-all", projectId],
    queryFn: async () => (await api.get(`/material-transactions?project_id=${projectId}`)).data as any[],
  });
  const laborQuery = useQuery({
    queryKey: ["site-labor-logs-all", projectId],
    queryFn: async () => (await api.get(`/labor-logs?project_id=${projectId}`)).data as any[],
  });

  const isLoading = materialsQuery.isLoading || transactionsQuery.isLoading || laborQuery.isLoading;

  const { filteredTransactions, filteredLabor } = useMemo(() => {
    const now = new Date();
    const todayDateStr = localDateStr(now);
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = localDateStr(monday);
    const weekEnd = localDateStr(sunday);
    const currentYearMonth = localDateStr(now).slice(0, 7);
    const currentYear = now.getFullYear().toString();

    const filterFn = (row: any) => {
      if (!row.date) return true;
      if (timeFilter === "today") return row.date === todayDateStr;
      if (timeFilter === "week") return row.date >= weekStart && row.date <= weekEnd;
      if (timeFilter === "month") return row.date.startsWith(currentYearMonth);
      if (timeFilter === "year") return row.date.startsWith(currentYear);
      if (timeFilter === "custom") {
        if (customStart && row.date < customStart) return false;
        if (customEnd && row.date > customEnd) return false;
      }
      return true;
    };

    return {
      filteredTransactions: (transactionsQuery.data ?? []).filter(filterFn),
      filteredLabor: (laborQuery.data ?? []).filter(filterFn),
    };
  }, [transactionsQuery.data, laborQuery.data, timeFilter, customStart, customEnd]);

  // Total cost per material row is the all-in figure — base cost plus
  // transportation/carrying, which are stored as their own columns (see
  // MaterialTransactionData) but still count toward the materials total.
  const allInCost = (t: any) => Number(t.total_cost ?? 0) + Number(t.transportation_cost ?? 0) + Number(t.carrying_cost ?? 0);
  // Effective average rate paid per unit across every purchase of this
  // material in the period — base cost only (excludes transport/carrying,
  // which aren't a per-unit price), so it reads as "what we actually paid
  // per piece", not inflated by delivery overhead.
  const avgRate = (m: { inQty: number; baseCost: number }) => (m.inQty > 0 ? m.baseCost / m.inQty : null);

  const materialsCost = filteredTransactions
    .filter((t: any) => t.type === "in")
    .reduce((s: number, t: any) => s + allInCost(t), 0);
  const laborCost = filteredLabor.reduce((s: number, l: any) => s + Number(l.total_cost ?? 0), 0);
  const siteCost = materialsCost + laborCost;

  const materialBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: string; inQty: number; cost: number; baseCost: number; transportCost: number; carryingCost: number; suppliers: Set<string> }
    >();
    filteredTransactions.forEach((t: any) => {
      const key = t.material_name ?? "Unknown material";
      const row =
        map.get(key) ??
        { name: key, unit: t.unit ?? "", inQty: 0, cost: 0, baseCost: 0, transportCost: 0, carryingCost: 0, suppliers: new Set<string>() };
      if (t.type === "in") {
        row.inQty += Number(t.quantity ?? 0);
        row.cost += allInCost(t);
        row.baseCost += Number(t.total_cost ?? 0);
        row.transportCost += Number(t.transportation_cost ?? 0);
        row.carryingCost += Number(t.carrying_cost ?? 0);
        if (t.supplier) row.suppliers.add(t.supplier);
      }
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions]);

  const laborBreakdown = useMemo(() => {
    const map = new Map<string, { type: string; headcount: number; cost: number }>();
    filteredLabor.forEach((l: any) => {
      const key = l.labor_type ?? "General Labor";
      const row = map.get(key) ?? { type: key, headcount: 0, cost: 0 };
      row.headcount += Number(l.headcount ?? 0);
      row.cost += Number(l.total_cost ?? 0);
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => a.type.localeCompare(b.type));
  }, [filteredLabor]);

  // Search only narrows what's shown on screen — CSV/PDF exports always use
  // the full materialBreakdown/laborBreakdown/stock list above, since an
  // export is meant to be the complete record for the period, not whatever
  // happened to be typed into the search box at that moment.
  const visibleMaterialBreakdown = useMemo(
    () => materialBreakdown.filter((m) => smartMatch(search, m.name, m.unit)),
    [materialBreakdown, search]
  );
  const visibleLaborBreakdown = useMemo(
    () => laborBreakdown.filter((l) => smartMatch(search, l.type)),
    [laborBreakdown, search]
  );
  const visibleStock = useMemo(
    () => (materialsQuery.data ?? []).filter((m: any) => smartMatch(search, m.name, m.unit)),
    [materialsQuery.data, search]
  );

  // RFC 4180 escaping, same as ReportsTab.tsx's own CSV export — a material
  // or labor-type name with a comma in it would otherwise silently corrupt
  // every column after it.
  function csvField(value: unknown): string {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }
  function csvRow(cells: unknown[]): string {
    return cells.map(csvField).join(",");
  }

  function handleExportCSV() {
    // Filter-wise — only the section currently selected in the view dropdown
    // goes into the export, same as what's shown on screen, instead of
    // always dumping Material/Labor/Stock together regardless of what was
    // actually being looked at.
    const rows: unknown[][] = [
      [`Daily Log Report — ${VIEW_LABELS[view]}`],
      ["Time Filter", DAILY_LOG_REPORT_FILTER_LABELS[timeFilter]],
      [],
    ];

    if (view === "materials") {
      rows.push(
        ["Summary", "Amount (BDT)"],
        ["Materials Cost", materialsCost],
        [],
        [
          "Material In/Out",
          "In Qty",
          "Rate (BDT)",
          "Supplier",
          "Transport (BDT)",
          "Carrying (BDT)",
          "Material Cost (BDT)",
          "Total Cost (BDT)",
        ],
        ...(materialBreakdown.length > 0
          ? [
              ...materialBreakdown.map((m) => [
                `${m.name} (${m.unit})`,
                Number(fmtQty(m.inQty)),
                avgRate(m) ?? "",
                [...m.suppliers].join("; ") || "",
                m.transportCost,
                m.carryingCost,
                m.baseCost,
                m.cost,
              ]),
              [
                "Total",
                "",
                "",
                "",
                materialBreakdown.reduce((s, m) => s + m.transportCost, 0),
                materialBreakdown.reduce((s, m) => s + m.carryingCost, 0),
                materialBreakdown.reduce((s, m) => s + m.baseCost, 0),
                materialsCost,
              ],
            ]
          : [["No material movement in this period.", "", "", "", "", "", "", ""]])
      );
    } else if (view === "labor") {
      rows.push(
        ["Summary", "Amount (BDT)"],
        ["Labor Cost", laborCost],
        [],
        ["Labor", "Headcount", "Cost (BDT)"],
        ...(laborBreakdown.length > 0
          ? [
              ...laborBreakdown.map((l) => [l.type, l.headcount, l.cost]),
              ["Total", laborBreakdown.reduce((s, l) => s + l.headcount, 0), laborCost],
            ]
          : [["No labor logged in this period.", "", ""]])
      );
    } else {
      rows.push(
        ["Current Stock Levels", "Unit", "Current Stock"],
        ...((materialsQuery.data ?? []).length > 0
          ? (materialsQuery.data ?? []).map((m: any) => [m.name, m.unit, m.current_stock ?? 0])
          : [["No materials found.", "", ""]])
      );
    }

    const csvContent = "﻿" + rows.map(csvRow).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily_log_${view}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Daily Log report exported");
  }

  async function handleExportPDF() {
    const doc = new jsPDF();
    const marginX = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 16;

    const bengaliFontB64 = await loadBengaliFontBase64();
    const bodyFont = bengaliFontB64 ? "NotoSansBengali" : "helvetica";
    if (bengaliFontB64) {
      doc.addFileToVFS("NotoSansBengali.ttf", bengaliFontB64);
      doc.addFont("NotoSansBengali.ttf", "NotoSansBengali", "normal");
      doc.addFont("NotoSansBengali.ttf", "NotoSansBengali", "bold");
    }

    const logo = reportAppLogo ? await loadImageAsDataUrl(reportAppLogo) : null;
    let logoDrawn = false;
    if (logo) {
      try {
        const props = doc.getImageProperties(logo.dataUrl);
        const logoH = 16;
        const logoW = (props.width / props.height) * logoH;
        doc.addImage(logo.dataUrl, logo.format, marginX, y - 3, logoW, logoH);
        logoDrawn = true;
      } catch {
        // Corrupt/unreadable logo file — fall back to the text-only header.
      }
    }

    // The logo already spells out the company name, so it stands alone —
    // the app name/subtitle text is only needed as a fallback when no logo
    // is configured (Admin > Settings) or it failed to load.
    if (!logoDrawn) {
      doc.setFontSize(15);
      doc.setFont(bodyFont, "bold");
      doc.text(reportAppName, marginX, y + 4);
      doc.setFont(bodyFont, "normal");
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(reportAppSubtitle, marginX, y + 9.5);
      doc.setTextColor(0);
    }
    y += logoDrawn ? 20 : 18;

    doc.setDrawColor(180, 140, 40);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    doc.setFontSize(13);
    doc.setFont(bodyFont, "bold");
    doc.text(`Daily Log Report — ${VIEW_LABELS[view]}`, marginX, y);
    doc.setFont(bodyFont, "normal");
    y += 6;
    doc.setFontSize(11);
    doc.text(projectQuery.data?.name || "", marginX, y);
    y += 5.5;
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Period: ${DAILY_LOG_REPORT_FILTER_LABELS[timeFilter]}   ·   Generated: ${new Date().toLocaleDateString()}`, marginX, y);
    doc.setTextColor(0);
    y += 7;

    const tableDefaults = {
      theme: "grid" as const,
      headStyles: {
        fillColor: [180, 140, 40] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: "bold" as const,
        font: bodyFont,
      },
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9, cellPadding: 2.5, font: bodyFont },
    };

    // Filter-wise — only the section currently selected in the view dropdown
    // goes into the PDF, matching what's on screen, instead of always
    // dumping Material/Labor/Stock together regardless of what was actually
    // being looked at.
    if (view === "materials") {
      const totalTransport = materialBreakdown.reduce((s, m) => s + m.transportCost, 0);
      const totalCarrying = materialBreakdown.reduce((s, m) => s + m.carryingCost, 0);
      const costBreakdown =
        totalTransport > 0 || totalCarrying > 0
          ? ` (Transport: ${pdfBDT(totalTransport)} · Carrying: ${pdfBDT(totalCarrying)})`
          : "";

      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [["Summary", "Amount"]],
        body: [[`Materials Cost${costBreakdown}`, pdfBDT(materialsCost)]],
        columnStyles: { 1: { halign: "right" } },
      });

      autoTable(doc, {
        ...tableDefaults,
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Material In/Out", "In Qty", "Rate", "Supplier", "Transport", "Carrying", "Material Cost", "Total Cost"]],
        body:
          materialBreakdown.length > 0
            ? materialBreakdown.map((m) => [
                `${m.name} (${m.unit})`,
                m.inQty > 0 ? fmtQty(m.inQty) : "—",
                avgRate(m) != null ? pdfBDT(avgRate(m) as number) : "—",
                [...m.suppliers].join("; ") || "—",
                m.transportCost > 0 ? pdfBDT(m.transportCost) : "—",
                m.carryingCost > 0 ? pdfBDT(m.carryingCost) : "—",
                pdfBDT(m.baseCost),
                pdfBDT(m.cost),
              ])
            : [["No material movement in this period.", "", "", "", "", "", "", ""]],
        foot:
          materialBreakdown.length > 0
            ? [
                [
                  "Total",
                  "",
                  "",
                  "",
                  pdfBDT(totalTransport),
                  pdfBDT(totalCarrying),
                  pdfBDT(materialBreakdown.reduce((s, m) => s + m.baseCost, 0)),
                  pdfBDT(materialsCost),
                ],
              ]
            : undefined,
        footStyles: { fillColor: [245, 240, 225], textColor: [20, 20, 20], fontStyle: "bold" as const, font: bodyFont },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
        },
      });
    } else if (view === "labor") {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [["Summary", "Amount"]],
        body: [["Labor Cost", pdfBDT(laborCost)]],
        columnStyles: { 1: { halign: "right" } },
      });

      autoTable(doc, {
        ...tableDefaults,
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Labor", "Headcount", "Cost"]],
        body:
          laborBreakdown.length > 0
            ? laborBreakdown.map((l) => [l.type, l.headcount, pdfBDT(l.cost)])
            : [["No labor logged in this period.", "", ""]],
        foot:
          laborBreakdown.length > 0
            ? [["Total", laborBreakdown.reduce((s, l) => s + l.headcount, 0), pdfBDT(laborCost)]]
            : undefined,
        footStyles: { fillColor: [245, 240, 225], textColor: [20, 20, 20], fontStyle: "bold" as const, font: bodyFont },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      });
    } else {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [["Current Stock Levels", "Unit", "Current Stock"]],
        body:
          (materialsQuery.data ?? []).length > 0
            ? (materialsQuery.data ?? []).map((m: any) => [m.name, m.unit, m.current_stock ?? 0])
            : [["No materials found.", "", ""]],
        columnStyles: { 2: { halign: "right" } },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text("53/2, D.I.T Extention Road, Fakirapool/Naya Paltan, Dhaka-1000  ·  info@brahmatholdings.com  ·  +8801898799700", marginX, pageHeight - 8);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
      doc.setTextColor(0);
    }

    doc.save(`daily_log_${view}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF report exported");
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-gold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Daily Log
        </button>
        <h2 className="font-display text-2xl font-semibold">Daily Log Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Material In/Out, Labor and current Stock only — see the Reports tab for financials and shareholders.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-gold" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as DailyLogReportFilter)}
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
                  <DatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">to</span>
                <div className="min-w-0 flex-1">
                  <DatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" />
                </div>
              </div>
            )}
            <span className="mx-1 hidden h-6 w-px shrink-0 bg-border/60 sm:block" />
            <select
              value={view}
              onChange={(e) => setView(e.target.value as typeof view)}
              className="rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-gold"
            >
              <option value="materials">Material In/Out</option>
              <option value="labor">Labor</option>
              <option value="stock">Stock Levels</option>
            </select>
            <div className="relative w-full max-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search materials, labor, stock…"
                className="w-full rounded-md border border-border bg-input py-1.5 pl-8 pr-3 text-xs text-foreground outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
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
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading report...</div>
        ) : (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Materials Cost" value={fmtBDT(materialsCost)} accent="red" />
              <StatCard label="Labor Cost" value={fmtBDT(laborCost)} accent="red" />
              <StatCard label="Total Site Cost" value={fmtBDT(siteCost)} accent="gold" />
            </div>

            {view === "materials" && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Material In/Out</h4>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate / Unit</th>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2 text-right">Transport</th>
                      <th className="px-3 py-2 text-right">Carrying</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          No material movement in this period.
                        </td>
                      </tr>
                    ) : visibleMaterialBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          No materials match "{search}".
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleMaterialBreakdown.map((m) => (
                          <tr key={m.name} className="border-t border-border/40">
                            <td className="px-3 py-2">{m.name}</td>
                            <td className="px-3 py-2 text-right">{m.inQty > 0 ? `${fmtQty(m.inQty)} ${m.unit}` : "—"}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {avgRate(m) != null ? fmtBDT(avgRate(m) as number) : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {m.suppliers.size > 0 ? [...m.suppliers].join(", ") : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {m.transportCost > 0 ? fmtBDT(m.transportCost) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {m.carryingCost > 0 ? fmtBDT(m.carryingCost) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {m.baseCost !== m.cost ? (
                                <>
                                  <div className="text-[11px] text-muted-foreground">
                                    Material: <span className="text-foreground">{fmtBDT(m.baseCost)}</span>
                                  </div>
                                  <div className="text-sm font-medium">
                                    <span className="text-xs font-normal text-muted-foreground">Total: </span>
                                    <span className="text-gold">{fmtBDT(m.cost)}</span>
                                  </div>
                                </>
                              ) : (
                                <span className="font-medium">{fmtBDT(m.cost)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-gold/40 bg-surface-2/60 font-semibold">
                          <td className="px-3 py-2" colSpan={4}>
                            Total
                          </td>
                          <td className="px-3 py-2 text-right">
                            {fmtBDT(visibleMaterialBreakdown.reduce((s, m) => s + m.transportCost, 0))}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {fmtBDT(visibleMaterialBreakdown.reduce((s, m) => s + m.carryingCost, 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-gold">
                            {fmtBDT(visibleMaterialBreakdown.reduce((s, m) => s + m.cost, 0))}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {view === "labor" && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Labor</h4>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Labor Type</th>
                      <th className="px-3 py-2 text-right">Headcount</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          No labor logged in this period.
                        </td>
                      </tr>
                    ) : visibleLaborBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          No labor matches "{search}".
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleLaborBreakdown.map((l) => (
                          <tr key={l.type} className="border-t border-border/40">
                            <td className="px-3 py-2">{l.type}</td>
                            <td className="px-3 py-2 text-right">{l.headcount}</td>
                            <td className="px-3 py-2 text-right font-medium">{fmtBDT(l.cost)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-gold/40 bg-surface-2/60 font-semibold">
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right">{visibleLaborBreakdown.reduce((s, l) => s + l.headcount, 0)}</td>
                          <td className="px-3 py-2 text-right text-gold">
                            {fmtBDT(visibleLaborBreakdown.reduce((s, l) => s + l.cost, 0))}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {view === "stock" && (
            <div>
              {/* Not period-filtered — a running balance (current stock) has
                  no meaningful "as of last month" reading the way a cost
                  total does; it's always the live figure. */}
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Current Stock Levels</h4>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2 text-right">Current Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(materialsQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          No materials found.
                        </td>
                      </tr>
                    ) : visibleStock.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          No materials match "{search}".
                        </td>
                      </tr>
                    ) : (
                      visibleStock.map((m: any) => (
                        <tr key={m.id} className="border-t border-border/40">
                          <td className="px-3 py-2">{m.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{m.unit}</td>
                          <td className="px-3 py-2 text-right font-medium">{m.current_stock ?? 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}
    </div>
  );
}

