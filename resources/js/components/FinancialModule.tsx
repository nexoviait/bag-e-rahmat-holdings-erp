import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate } from "@/lib/format";
import { useCanEditFinancials } from "@/lib/session";
import { DatePicker } from "@/components/DatePicker";
import { Plus, Trash2, Edit2, Loader2, X, Download, Search, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Row = Record<string, any>;

export type FinancialField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
  allowCustom?: boolean;
  required?: boolean;
  placeholder?: string;
};

export function FinancialModule({
  projectId,
  table,
  title,
  singular,
  amountField = "amount",
  fields,
  extraColumns,
}: {
  projectId: string;
  table: "budgets" | "revenues" | "expenses" | "owner_payments";
  title: string;
  singular: string;
  amountField?: string;
  fields: FinancialField[];
  extraColumns?: { key: string; label: string; render?: (row: Row) => React.ReactNode }[];
}) {
  const qc = useQueryClient();
  const canEdit = useCanEditFinancials();
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const list = useQuery({
    queryKey: [table, projectId],
    queryFn: async () => {
      const res = await api.get(`/financials/${table}?project_id=${projectId}`);
      return res.data as Row[];
    },
  });

  const projectRes = useQuery({
    queryKey: ["project-details", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const filteredData = useMemo(() => {
    let rows = list.data ?? [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) => val != null && String(val).toLowerCase().includes(term))
      );
    }
    if (startDate) {
      rows = rows.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      rows = rows.filter((r) => r.date <= endDate);
    }
    return rows;
  }, [list.data, searchTerm, startDate, endDate]);

  const total = filteredData.reduce((s, r) => s + Number(r[amountField] ?? 0), 0);
  const projectTotalBudget = Number(projectRes.data?.total_shareholder_project_price ?? 0);
  const displayTotalBudget = table === "budgets" && projectTotalBudget > 0 ? projectTotalBudget : total;
  const unallocatedBudget = Math.max(0, projectTotalBudget - total);

  const del = useMutation({
    mutationFn: async (row: Row) => {
      await api.delete(`/financials/${table}/${row.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, projectId] });
      qc.invalidateQueries({ queryKey: ["project-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      toast.success(`${singular} deleted`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  function exportCSV() {
    if (!filteredData.length) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Date", ...fields.map((f) => f.label), "Amount (BDT)"];
    const rows = filteredData.map((r) => [
      r.date || "",
      ...fields.map((f) => (r[f.key] != null ? `"${String(r[f.key]).replace(/"/g, '""')}"` : "")),
      r[amountField] || 0,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total {title.toLowerCase()}:{" "}
            <span className="font-semibold text-gold font-display text-base">{fmtBDT(displayTotalBudget)}</span>
            {table === "budgets" && projectTotalBudget > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                ({fmtBDT(total)} allocated in {filteredData.length} items · {fmtBDT(unallocatedBudget)} remaining)
              </span>
            )}
            {table !== "budgets" && (
              <> · {filteredData.length} {filteredData.length === 1 ? "record" : "records"}</>
            )}
            {(searchTerm || startDate || endDate) && ` (filtered from ${list.data?.length ?? 0})`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-gold" /> Export CSV
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingRow(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add {singular}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-12 items-center rounded-lg border border-border/60 bg-surface-1 p-3">
        <div className="relative sm:col-span-6 md:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-1.5 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-6 md:col-span-7">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Calendar className="h-3.5 w-3.5 text-gold" /> Date:
          </div>
          <div className="min-w-0 flex-1">
            <DatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              placeholder="Start Date"
            />
          </div>
          <span className="shrink-0 text-muted-foreground text-xs">to</span>
          <div className="min-w-0 flex-1">
            <DatePicker
              value={endDate}
              onChange={(val) => setEndDate(val)}
              placeholder="End Date"
            />
          </div>
        </div>
        {(searchTerm || startDate || endDate) && (
          <div className="sm:col-span-12 md:col-span-1 flex justify-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setStartDate("");
                setEndDate("");
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold cursor-pointer"
              title="Clear filters"
            >
              <RefreshCw className="h-3 w-3" /> Clear
            </button>
          </div>
        )}
      </div>

      {list.isLoading && (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">Loading…</div>
      )}
      {filteredData.length === 0 && !list.isLoading && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          {searchTerm || startDate || endDate
            ? `No matching ${title.toLowerCase()} found.`
            : `No ${title.toLowerCase()} yet.`}
        </div>
      )}

      {/* Mobile / tablet: card list */}
      {filteredData.length > 0 && (
        <div className="grid gap-3 lg:hidden">
          {filteredData.map((row) => (
            <div key={row.id} className="noir-panel min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-muted-foreground">{fmtDate(row.date)}</div>
                <div className="font-semibold gold-text">{fmtBDT(row[amountField])}</div>
              </div>

              <div className="mt-2 space-y-1.5">
                {fields
                  .filter((f) => f.key !== "date" && f.key !== amountField && f.type !== "textarea")
                  .map((f) => (
                    <div key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {f.label}
                      </span>
                      <span className="text-right text-foreground">{row[f.key] ?? "—"}</span>
                    </div>
                  ))}
                {extraColumns?.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </span>
                    <span className="text-right text-foreground">{c.render ? c.render(row) : row[c.key] ?? "—"}</span>
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/40 pt-3">
                  <button
                    onClick={() => {
                      setEditingRow(row);
                      setOpen(true);
                    }}
                    title="Edit"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      confirm(`Delete this ${singular.toLowerCase()}?`) && del.mutate(row)
                    }
                    title="Delete"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Desktop: table */}
      {filteredData.length > 0 && (
        <div className="noir-panel hidden overflow-hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  {fields
                    .filter((f) => f.key !== "date" && f.key !== amountField && f.type !== "textarea")
                    .map((f) => (
                      <th key={f.key} className="px-4 py-3">
                        {f.label}
                      </th>
                    ))}
                  {extraColumns?.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Amount</th>
                  {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.date)}</td>
                    {fields
                      .filter((f) => f.key !== "date" && f.key !== amountField && f.type !== "textarea")
                      .map((f) => (
                        <td key={f.key} className="px-4 py-3">
                          {row[f.key] ?? "—"}
                        </td>
                      ))}
                    {extraColumns?.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render ? c.render(row) : row[c.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium">{fmtBDT(row[amountField])}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingRow(row);
                              setOpen(true);
                            }}
                            title="Edit"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              confirm(`Delete this ${singular.toLowerCase()}?`) && del.mutate(row)
                            }
                            title="Delete"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <RecordDialog
          projectId={projectId}
          table={table}
          singular={singular}
          fields={fields}
          amountField={amountField}
          initialData={editingRow}
          onClose={() => {
            setOpen(false);
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
}

function RecordDialog({
  projectId,
  table,
  singular,
  fields,
  amountField,
  initialData,
  onClose,
}: {
  projectId: string;
  table: string;
  singular: string;
  fields: FinancialField[];
  amountField: string;
  initialData?: Row | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [customModes, setCustomModes] = useState<Record<string, boolean>>({});

  const [values, setValues] = useState<Row>(() => {
    if (initialData) {
      return { ...initialData };
    }
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randNum = Math.floor(100 + Math.random() * 900);
    const prefix =
      table === "revenues"
        ? "INV"
        : table === "expenses"
        ? "EXP"
        : table === "budgets"
        ? "BDG"
        : "REF";

    const initial: Row = {
      date: new Date().toISOString().slice(0, 10),
      reference_no: `${prefix}-${todayStr}-${randNum}`,
    };
    for (const f of fields) {
      if (!(f.key in initial)) initial[f.key] = "";
    }
    return initial;
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: Row = { project_id: projectId };
      for (const f of fields) {
        const v = values[f.key];
        payload[f.key] =
          f.type === "number" || f.key === amountField ? Number(v) : v === "" ? null : v;
      }

      if (initialData?.id) {
        await api.put(`/financials/${table}/${initialData.id}`, payload);
      } else {
        await api.post(`/financials/${table}`, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, projectId] });
      qc.invalidateQueries({ queryKey: ["project-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      toast.success(initialData ? `${singular} updated` : `${singular} added`);
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">
            {initialData ? `Edit ${singular}` : `Add ${singular}`}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-5 space-y-4"
        >
          {fields.map((f) => {
            const isCustom = customModes[f.key];
            const isRef = f.key === "reference_no";

            return (
              <div key={f.key} className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </span>
                  {isRef && !initialData && (
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                        const randNum = Math.floor(100 + Math.random() * 900);
                        const prefix =
                          table === "revenues" ? "INV" : table === "expenses" ? "EXP" : "REF";
                        setValues((p: any) => ({
                          ...p,
                          [f.key]: `${prefix}-${todayStr}-${randNum}`,
                        }));
                      }}
                      className="text-[11px] text-gold hover:underline font-medium cursor-pointer"
                    >
                      ⚡ Auto Generate
                    </button>
                  )}
                  {f.allowCustom && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomModes((prev) => ({ ...prev, [f.key]: !prev[f.key] }));
                        setValues((prev: any) => ({ ...prev, [f.key]: "" }));
                      }}
                      className="text-[11px] text-gold hover:underline font-medium cursor-pointer"
                    >
                      {isCustom ? "← Select from Dropdown" : "+ Add Custom"}
                    </button>
                  )}
                </div>

                {f.type === "date" || f.key === "date" ? (
                  <DatePicker
                    value={values[f.key] ?? ""}
                    onChange={(val) => setValues({ ...values, [f.key]: val })}
                    placeholder="Select date"
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="dlg-input min-h-[80px]"
                  />
                ) : f.type === "select" && !isCustom ? (
                  <select
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setCustomModes((prev) => ({ ...prev, [f.key]: true }));
                        setValues({ ...values, [f.key]: "" });
                      } else {
                        setValues({ ...values, [f.key]: e.target.value });
                      }
                    }}
                    className="dlg-input"
                  >
                    <option value="">{f.placeholder || "-- Select Option --"}</option>
                    {f.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    {f.allowCustom && (
                      <option value="__custom__">➕ + Add New Custom...</option>
                    )}
                  </select>
                ) : (
                  <input
                    required={f.required}
                    type={f.type === "number" ? "number" : "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder || `Enter custom ${f.label.toLowerCase()}...`}
                    className="dlg-input"
                  />
                )}
              </div>
            );
          })}
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData ? `Update ${singular}` : `Save ${singular}`}
          </button>
        </form>
        <style>{`
          .dlg-input {
            width: 100%;
            background: var(--input);
            border: 1px solid var(--border);
            color: var(--foreground);
            border-radius: 0.5rem;
            padding: 0.6rem 0.8rem;
            font-size: 0.9rem;
            outline: none;
          }
          .dlg-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px color-mix(in oklab, var(--gold) 20%, transparent); }
        `}</style>
      </div>
    </div>
  );
}
