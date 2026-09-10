import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { DatePicker } from "@/components/DatePicker";
import { fmtBDT } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import { Loader2, Plus, X, AlertTriangle, Trash2, Package, Search, Paperclip, Edit2 } from "lucide-react";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";
import { toast } from "sonner";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_20%,transparent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// Standard construction-material units — covers the metric/count units used
// across the app plus the local units (Goj, Suta) that already show up in the
// user's own purchase records, with a custom-unit escape hatch for anything
// else, same "select, or type your own" pattern as FinancialModule's category/
// source fields.
const UNIT_OPTIONS = ["Bag", "Ton", "Kg", "CFT", "Sft", "Rft", "Piece", "Roll", "Liter", "Set", "Lot", "Truck", "Goj", "Suta"];

// Same lists FinancialTab.tsx already uses for the Expenses/Revenue tabs —
// kept identical here so a quick-add from Daily Log lands in the same
// categories/sources the Reports tab groups by, rather than fragmenting them.
const EXPENSE_CATEGORIES = [
  "Civil Structure & Concrete", "Electrical Supplies", "Plumbing & Sanitation",
  "Raw Materials & Cement", "Labor & Subcontractor", "Site Equipment & Fuel",
  "Legal & Licensing", "Office & Admin Expense",
];
const REVENUE_SOURCES = [
  "Unit Pre-sale", "Apartment Booking", "Commercial Shop Rent", "Car Parking Slot",
  "Service Charge", "Utility Deposit", "Other Revenue",
];
const LABOR_TYPES = [
  "Mason", "Helper", "Electrician", "Plumber", "Carpenter", "Painter",
  "Rod Binder", "Welder", "Tiles Worker", "Supervisor", "Security Guard", "General Labor",
];

/** A dropdown of standard options with a "+ Add custom" escape hatch — used
 * for Unit, Expense Category and Revenue Source alike. */
function SelectWithCustom({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
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
        <input required className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Type a ${label.toLowerCase()}`} />
      ) : (
        <select
          required
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
  const [activeDialog, setActiveDialog] = useState<
    "material" | "transaction" | "labor" | "expense" | "revenue" | null
  >(null);
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
  const canCreateFinancials = useHasPermission("financials.create");
  const receiptPreview = useReceiptPreview();

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
    queryKey: ["site-material-transactions", projectId, date],
    enabled: canViewMaterials,
    queryFn: async () => {
      const res = await api.get(`/material-transactions?project_id=${projectId}&date=${date}`);
      return res.data as any[];
    },
  });

  const laborLogsQuery = useQuery({
    queryKey: ["site-labor-logs", projectId, date],
    enabled: canViewLabor,
    queryFn: async () => {
      const res = await api.get(`/labor-logs?project_id=${projectId}&date=${date}`);
      return res.data as any[];
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["site-daily-summary", projectId, date],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/daily-summary?date=${date}`);
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
    () => materialRows.filter((r: any) => smartMatch(search, r.material_name, r.supplier, r.used_for)),
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateFinancials && (
            <>
              <button onClick={() => setActiveDialog("expense")} className="pill-btn">
                <Plus className="h-3.5 w-3.5" /> Expense
              </button>
              <button onClick={() => setActiveDialog("revenue")} className="pill-btn">
                <Plus className="h-3.5 w-3.5" /> Revenue
              </button>
            </>
          )}
          {canCreateMaterials && (
            <>
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setActiveDialog("material");
                }}
                className="pill-btn"
              >
                <Plus className="h-3.5 w-3.5" /> Material
              </button>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setActiveDialog("transaction");
                }}
                className="pill-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" /> Material In/Out
              </button>
            </>
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
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Expenses (this day)" value={fmtBDT(summaryQuery.data?.expenses ?? 0)} accent="red" />
        <StatCard label="Revenue (this day)" value={fmtBDT(summaryQuery.data?.revenue ?? 0)} accent="green" />
        <StatCard label="Materials Cost" value={fmtBDT(summaryQuery.data?.materialsCost ?? 0)} accent="red" />
        <StatCard label="Labor Cost" value={fmtBDT(summaryQuery.data?.laborCost ?? 0)} accent="red" />
        <StatCard label="Net (this day)" value={fmtBDT(summaryQuery.data?.net ?? 0)} accent="gold" />
      </div>

      {canViewMaterials && (
        <div className="noir-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gold" />
              <h3 className="font-display text-lg font-semibold">Stock Levels</h3>
            </div>
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

          <div className="border-t border-border/60 px-5 py-4">
            <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Material In/Out — {date}</h4>
            {materialRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No material movement recorded for this date.</div>
            ) : filteredMaterialRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries match "{search}".</div>
            ) : (
              <div className="space-y-2">
                {filteredMaterialRows.map((r: any) => {
                  const tag = r.type === "in" && r.supplier ? `Supplier: ${r.supplier}` : null;
                  const workItem = r.used_for ? `Work item: ${r.used_for}` : null;
                  const transport = r.transportation_cost != null ? `Transport: ${fmtBDT(r.transportation_cost)}` : null;
                  const carrying = r.carrying_cost != null ? `Carrying: ${fmtBDT(r.carrying_cost)}` : null;
                  const detail = [tag, workItem, transport, carrying].filter(Boolean).join(" · ");
                  const qtyLabel = r.quantity != null ? `${r.quantity} ${r.unit} of ` : "";
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
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
                        {r.total_cost != null && <span className="font-medium">{fmtBDT(r.total_cost)}</span>}
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
                            onClick={() => deleteTransaction.mutate(r.id)}
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

      {canViewLabor && (
        <div className="noir-panel overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <h3 className="font-display text-lg font-semibold">Labor — {date}</h3>
          </div>
          <div className="px-5 py-4">
            {laborRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No labor logged for this date.</div>
            ) : (
              <div className="space-y-2">
                {laborRows.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm">
                        {r.headcount} × {r.labor_type}
                      </span>
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
                          onClick={() => deleteLabor.mutate(r.id)}
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

      <div className="noir-panel overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="font-display text-lg font-semibold">Full timeline — {date}</h3>
        </div>
        {summaryQuery.isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">Nothing recorded for this date yet.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {timeline.map((r: any) => (
              <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
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

      {activeDialog === "material" && (
        <AddMaterialModal
          projectId={projectId}
          initialData={editingMaterial}
          onClose={() => {
            setActiveDialog(null);
            setEditingMaterial(null);
          }}
          onSaved={invalidateAll}
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
      {activeDialog === "expense" && (
        <AddFinancialModal
          projectId={projectId}
          date={date}
          type="expenses"
          title="Add Expense"
          onClose={() => setActiveDialog(null)}
          onSaved={invalidateAll}
        />
      )}
      {activeDialog === "revenue" && (
        <AddFinancialModal
          projectId={projectId}
          date={date}
          type="revenues"
          title="Add Revenue"
          onClose={() => setActiveDialog(null)}
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
}: {
  projectId: string;
  initialData?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [unit, setUnit] = useState(initialData?.unit ?? "");
  const [reorderLevel, setReorderLevel] = useState(initialData?.reorder_level != null ? String(initialData.reorder_level) : "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        name,
        unit,
        reorder_level: reorderLevel || null,
        notes: notes || null,
      };
      if (isEditing) return api.put(`/materials/${initialData.id}`, payload);
      return api.post("/materials", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Material updated" : "Material added");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <ModalShell title={isEditing ? "Edit material" : "Add material"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <Field label="Material name">
          <input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cement (OPC 52.5)" />
        </Field>
        <SelectWithCustom label="Unit" value={unit} onChange={setUnit} options={UNIT_OPTIONS} />
        <Field label="Reorder level (optional)">
          <input type="number" step="any" min="0" className={inputCls} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="Alert when stock falls below this" />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputCls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isEditing ? "Update material" : "Add material"}
        </button>
      </form>
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
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptPreview = useReceiptPreview();

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

  const save = useMutation({
    mutationFn: async () => {
      let id = materialId;
      if (isNewMaterial) {
        const res = await api.post("/materials", { project_id: projectId, name: newName, unit: newUnit });
        id = res.data.id;
      }
      const payload: Record<string, any> = {
        project_id: projectId,
        material_id: id,
        type,
        date,
        quantity: quantity || null,
        unit_price: type === "in" ? unitPrice || null : null,
        total_cost: displayAmount || null,
        transportation_cost: type === "in" ? transportationCost || null : null,
        carrying_cost: type === "in" ? carryingCost || null : null,
        supplier: type === "in" ? supplier || null : null,
        used_for: usedFor || null,
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
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <ModalShell title={isEditing ? "Edit material transaction" : "Record material purchase / usage"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        {isNewMaterial ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="New item name">
              <input required className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='e.g. Poli (20 goj)' />
            </Field>
            <SelectWithCustom label="Unit" value={newUnit} onChange={setNewUnit} options={UNIT_OPTIONS} />
          </div>
        ) : (
          <Field label="Item">
            <select required className={inputCls} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
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
          <Field label="Quantity (optional)">
            <input type="number" step="any" min="0" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Leave blank if N/A" />
          </Field>
          {type === "in" && (
            <Field label="Rate / unit (optional)">
              <input type="number" step="any" min="0" className={inputCls} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </Field>
          )}
        </div>

        <Field label={type === "in" ? "Amount (BDT)" : "Amount (BDT, optional)"}>
          <input
            required={type === "in"}
            type="number"
            step="any"
            min="0"
            className={inputCls}
            value={displayAmount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
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

        <Field label="Receipt (optional — JPG, PNG or PDF)">
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
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
  const [laborType, setLaborType] = useState(initialData?.labor_type ?? "");
  const [headcount, setHeadcount] = useState(initialData?.headcount != null ? String(initialData.headcount) : "");
  const [wageRate, setWageRate] = useState(initialData?.wage_rate != null ? String(initialData.wage_rate) : "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const autoTotal = (Number(headcount) || 0) * (Number(wageRate) || 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        date,
        labor_type: laborType,
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
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <ModalShell title={isEditing ? "Edit labor entry" : "Log daily labor"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <SelectWithCustom label="Labor type" value={laborType} onChange={setLaborType} options={LABOR_TYPES} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Headcount">
            <input required type="number" min="1" className={inputCls} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
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

function AddFinancialModal({
  projectId,
  date,
  type,
  title,
  onClose,
  onSaved,
}: {
  projectId: string;
  date: string;
  type: "expenses" | "revenues";
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const fields: Record<string, any> = {
        project_id: projectId,
        date,
        amount,
        description: description || "",
        ...(type === "expenses" ? { category: label } : { source: label }),
      };

      if (!receipt) {
        return api.post(`/financials/${type}`, fields);
      }

      // A file forces multipart — the shared `api` instance defaults to
      // Content-Type: application/json, which would otherwise JSON-stringify
      // the FormData body and silently drop the actual file.
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v ?? ""));
      formData.append("receipt", receipt);
      return api.post(`/financials/${type}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success(type === "expenses" ? "Expense added" : "Revenue added");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <SelectWithCustom
          label={type === "expenses" ? "Category" : "Source"}
          value={label}
          onChange={setLabel}
          options={type === "expenses" ? EXPENSE_CATEGORIES : REVENUE_SOURCES}
        />
        <Field label="Amount (BDT)">
          <input required type="number" step="any" min="0" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <textarea className={`${inputCls} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Receipt (optional — JPG, PNG or PDF)">
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            className={`${inputCls} file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground`}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          This is saved for {date} and will also appear in the {type === "expenses" ? "Expenses" : "Revenue"} tab.
        </p>
        <button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
      </form>
    </ModalShell>
  );
}
