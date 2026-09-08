import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCanEditFinancials, useIsAdmin, useSession } from "@/lib/session";
import { fmtBDT, fmtDate } from "@/lib/format";
import { DatePicker } from "@/components/DatePicker";
import { Plus, Trash2, Edit2, X, Loader2, AlertCircle, PieChart, Wallet, DollarSign, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

export function ShareholdersTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const canEdit = useCanEditFinancials();
  const { user } = useSession();

  const [openSh, setOpenSh] = useState(false);
  const [editingSh, setEditingSh] = useState<any | null>(null);
  const [investFor, setInvestFor] = useState<{ id: number | string; name: string } | null>(null);
  const [editingInvest, setEditingInvest] = useState<any | null>(null);

  const shareholders = useQuery({
    queryKey: ["shareholders", projectId],
    queryFn: async () => {
      const res = await api.get(`/shareholders?project_id=${projectId}`);
      return res.data;
    },
  });

  const investments = useQuery({
    queryKey: ["shareholder_investments", projectId],
    queryFn: async () => {
      const res = await api.get(`/shareholder-investments?project_id=${projectId}`);
      return res.data;
    },
  });

  const ownerPayments = useQuery({
    queryKey: ["owner_payments", projectId],
    queryFn: async () => {
      const res = await api.get(`/financials/owner_payments?project_id=${projectId}`);
      return res.data;
    },
  });

  const projectDetails = useQuery({
    queryKey: ["project-for-sh-calc", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const totalByShareholder = (id: number | string) =>
    (investments.data ?? [])
      .filter((i: any) => i.shareholder_id === id)
      .reduce((s: number, i: any) => s + Number(i.amount), 0);

  const totalInvest = (investments.data ?? []).reduce(
    (s: number, i: any) => s + Number(i.amount),
    0
  );
  const totalOwnership = (shareholders.data ?? []).reduce(
    (s: number, sh: any) => s + Number(sh.effective_ownership_pct ?? sh.ownership_pct ?? 0),
    0
  );

  const totalOwnerPayouts = (ownerPayments.data ?? []).reduce(
    (sum: number, op: any) => sum + Number(op.amount),
    0
  );

  const projBudget = Number(projectDetails.data?.total_shareholder_project_price ?? 0);
  const projTotalShares = Number(projectDetails.data?.total_shareholders ?? 0);

  const delSh = useMutation({
    mutationFn: async (sh: any) => {
      await api.delete(`/shareholders/${sh.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      toast.success("Shareholder removed");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const delInvest = useMutation({
    mutationFn: async (inv: any) => {
      await api.delete(`/shareholder-investments/${inv.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholder_investments", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      toast.success("Investment record deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  // Non-Admin User Personal Overview View
  if (!isAdmin && shareholders.data && shareholders.data.length > 0) {
    const mySh = shareholders.data.find((s: any) => String(s.user_id) === String(user?.id)) ?? shareholders.data[0];
    const myPaid = totalByShareholder(mySh.id);

    const pct = Number(mySh.effective_ownership_pct ?? mySh.ownership_pct ?? 0);
    const count = Number(mySh.effective_share_count ?? mySh.share_count ?? 0);

    let myTotalPrice = 0;
    if (projBudget > 0) {
      if (mySh.share_type === "share_count" && projTotalShares > 0) {
        myTotalPrice = (count / projTotalShares) * projBudget;
      } else if (pct > 0) {
        myTotalPrice = (pct / 100) * projBudget;
      }
    } else if (mySh.total_agreed_amount) {
      myTotalPrice = Number(mySh.total_agreed_amount);
    }

    const myRemaining = Math.max(0, myTotalPrice - myPaid);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">My Investment & Equity Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal investor breakdown for <span className="font-medium text-foreground">{mySh.name}</span>.
          </p>
        </div>

        {/* 4 Stat Cards for Non-Admin User */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="noir-panel p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Share Percentage</span>
              <PieChart className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold gold-text">
              {pct}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {count > 0 ? `(${count} Shares)` : "Equity Allocation"}
            </div>
          </div>

          <div className="noir-panel p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Total Share Price</span>
              <Wallet className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-foreground">
              {fmtBDT(myTotalPrice)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Agreed Share Value</div>
          </div>

          <div className="noir-panel p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Total Paid Price</span>
              <DollarSign className="h-4 w-4 text-[color:var(--success)]" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-[color:var(--success)]">
              {fmtBDT(myPaid)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Injected Capital</div>
          </div>

          <div className="noir-panel p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Remaining Price Due</span>
              <ArrowDownRight className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-foreground">
              {fmtBDT(myRemaining)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Outstanding Balance</div>
          </div>
        </div>

        {/* User's Investment History */}
        <div>
          <h3 className="mb-4 font-display text-xl font-semibold">My Investment History</h3>
          {investments.data?.length === 0 ? (
            <div className="noir-panel px-4 py-10 text-center text-muted-foreground">
              No investment records logged yet.
            </div>
          ) : (
            <>
              {/* Mobile / tablet: card list */}
              <div className="grid gap-3 lg:hidden">
                {investments.data?.map((inv: any) => (
                  <div key={inv.id} className="noir-panel min-w-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{fmtDate(inv.date)}</span>
                      <span className="font-medium gold-text">{fmtBDT(inv.amount)}</span>
                    </div>
                    {inv.note && <div className="mt-1.5 text-sm text-muted-foreground">{inv.note}</div>}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="noir-panel hidden overflow-hidden lg:block">
                <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.data?.map((inv: any) => (
                      <tr
                        key={inv.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface-2/50"
                      >
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.note ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium gold-text">
                          {fmtBDT(inv.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Shareholders & Investors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total Share Project Budget:{" "}
            <span className="font-medium text-gold">{fmtBDT(projBudget)}</span> · Paid:{" "}
            <span className="font-medium text-[color:var(--success)]">{fmtBDT(totalInvest)}</span> ·{" "}
            {shareholders.data?.length ?? 0} Shareholders · Allocated Equity:{" "}
            <span className="font-medium text-foreground">{totalOwnership}%</span>
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingSh(null);
              setOpenSh(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add shareholder
          </button>
        )}
      </div>

      {totalOwnership > 100 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            Warning: Total allocated ownership percentage is <strong>{totalOwnership}%</strong>,
            which exceeds 100%. Please review shareholder allocations.
          </span>
        </div>
      )}

      {/* Ownership Progress Meter */}
      <div className="mb-6 rounded-lg border border-border bg-surface-1 p-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium uppercase tracking-wider text-muted-foreground">
            Equity Allocation
          </span>
          <span className="font-semibold">{totalOwnership}% / 100%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full transition-all duration-300 ${
              totalOwnership > 100 ? "bg-destructive" : "bg-gold"
            }`}
            style={{ width: `${Math.min(totalOwnership, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shareholders.data?.length === 0 && (
          <div className="noir-panel col-span-full p-10 text-center text-muted-foreground">
            No shareholders recorded for this project yet.
          </div>
        )}
        {shareholders.data?.map((s: any) => {
          const paidPrice = totalByShareholder(s.id);
          const pct = Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0);
          const count = Number(s.effective_share_count ?? s.share_count ?? 0);

          let totalPrice = 0;
          if (projBudget > 0) {
            if (s.share_type === "share_count" && projTotalShares > 0) {
              totalPrice = (count / projTotalShares) * projBudget;
            } else if (pct > 0) {
              totalPrice = (pct / 100) * projBudget;
            }
          } else if (s.total_agreed_amount) {
            totalPrice = Number(s.total_agreed_amount);
          }

          const hasExtra = paidPrice > totalPrice && totalPrice > 0;
          const extraAmount = hasExtra ? paidPrice - totalPrice : 0;
          const remainingPrice = Math.max(0, totalPrice - paidPrice);

          return (
            <div key={s.id} className="noir-panel p-5 space-y-4 hover:border-gold/50 transition-all shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-border/60">
                  <div>
                    <div className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <span>{s.name}</span>
                    </div>
                    {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                    {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSh(s);
                          setOpenSh(true);
                        }}
                        title="Edit shareholder"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirm(`Remove ${s.name}?`) && delSh.mutate(s)}
                        title="Delete shareholder"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-surface-1/60 p-2.5 rounded-lg border border-border/40">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ownership Equity
                    </div>
                    <div className="mt-1 font-display text-lg font-bold text-foreground">
                      {pct}%
                      {count > 0 && (
                        <span className="block text-xs font-normal text-gold">
                          ({count} {count === 1 ? "Share" : "Shares"})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-surface-1/60 p-2.5 rounded-lg border border-border/40">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Share Price
                    </div>
                    <div className="mt-1 font-display text-lg font-bold text-gold">
                      {fmtBDT(totalPrice)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
                  <div className="bg-surface-1/60 p-2.5 rounded-lg border border-border/40">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Paid Price
                    </div>
                    <div className="mt-1 font-display text-base font-bold text-[color:var(--success)]">
                      {fmtBDT(paidPrice)}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${hasExtra ? "border-emerald-500/40 bg-emerald-500/10" : "bg-surface-1/60 border-border/40"}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {hasExtra ? "Extra Paid / Advance" : "Remaining Price"}
                    </div>
                    <div className={`mt-1 font-display text-base font-bold ${hasExtra ? "text-emerald-400" : remainingPrice > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {hasExtra ? `+${fmtBDT(extraAmount)}` : fmtBDT(remainingPrice)}
                    </div>
                    {hasExtra && (
                      <span className="block text-[10px] text-emerald-400/80 font-medium mt-0.5">
                        (Overpaid Surplus)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={() => {
                    setEditingInvest(null);
                    setInvestFor({ id: s.id, name: s.name });
                  }}
                  className="w-full mt-2 py-2 rounded-lg border border-gold/40 bg-gold/10 hover:bg-gold hover:text-slate-950 text-gold text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Log Investment
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <h3 className="mb-4 font-display text-xl font-semibold">Investment history</h3>
        {investments.data?.length === 0 ? (
          <div className="noir-panel px-4 py-10 text-center text-muted-foreground">
            No investments recorded.
          </div>
        ) : (
          <>
            {/* Mobile / tablet: card list */}
            <div className="grid gap-3 lg:hidden">
              {investments.data?.map((inv: any) => {
                const sh = shareholders.data?.find((s: any) => s.id === inv.shareholder_id);
                return (
                  <div key={inv.id} className="noir-panel min-w-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {sh?.name ?? inv.shareholder?.name ?? "—"}
                      </span>
                      <span className="shrink-0 font-medium gold-text">{fmtBDT(inv.amount)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtDate(inv.date)}</div>
                    {inv.note && <div className="mt-1.5 text-sm text-muted-foreground">{inv.note}</div>}
                    {canEdit && (
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/40 pt-3">
                        <button
                          onClick={() =>
                            setEditingInvest({
                              ...inv,
                              shareholder_name: sh?.name ?? inv.shareholder?.name,
                            })
                          }
                          title="Edit investment"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            confirm("Delete this investment record?") && delInvest.mutate(inv)
                          }
                          title="Delete investment"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
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
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Shareholder</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {investments.data?.map((inv: any) => {
                    const sh = shareholders.data?.find((s: any) => s.id === inv.shareholder_id);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface-2/50"
                      >
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.date)}</td>
                        <td className="px-4 py-3 font-medium">{sh?.name ?? inv.shareholder?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.note ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium gold-text">
                          {fmtBDT(inv.amount)}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setEditingInvest({
                                    ...inv,
                                    shareholder_name: sh?.name ?? inv.shareholder?.name,
                                  })
                                }
                                title="Edit investment"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  confirm("Delete this investment record?") && delInvest.mutate(inv)
                                }
                                title="Delete investment"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}
      </div>

      {openSh && (
        <ShareholderDialog
          projectId={projectId}
          initialData={editingSh}
          onClose={() => {
            setOpenSh(false);
            setEditingSh(null);
          }}
        />
      )}
      {investFor && (
        <InvestmentDialog
          projectId={projectId}
          shareholder={investFor}
          onClose={() => setInvestFor(null)}
        />
      )}
      {editingInvest && (
        <InvestmentDialog
          projectId={projectId}
          shareholder={{
            id: editingInvest.shareholder_id,
            name: editingInvest.shareholder_name || "Shareholder",
          }}
          initialData={editingInvest}
          onClose={() => setEditingInvest(null)}
        />
      )}
    </>
  );
}

function ShareholderDialog({
  projectId,
  initialData,
  onClose,
}: {
  projectId: string;
  initialData?: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    user_id: initialData?.user_id ? String(initialData.user_id) : "",
    name: initialData?.name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    share_type: (initialData?.share_type as "percentage" | "share_count") ?? "percentage",
    ownership_pct: initialData?.ownership_pct ? String(initialData.ownership_pct) : "",
    share_count: initialData?.share_count ? String(initialData.share_count) : "",
    notes: initialData?.notes ?? "",
  });

  const { data: projectDetails } = useQuery({
    queryKey: ["project-for-sh-calc", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const { data: systemUsers } = useQuery({
    queryKey: ["system-users-for-sh"],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/users");
        return res.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Exclude super_admin and admin accounts from shareholder assignment
  const userRoleOptions = useMemo(() => {
    if (!Array.isArray(systemUsers)) return [];
    return systemUsers.filter((u: any) => {
      const rolesList = u.roles || [];
      const firstRole = Array.isArray(rolesList)
        ? typeof rolesList[0] === "string"
          ? rolesList[0]
          : rolesList[0]?.name
        : u.role;
      return firstRole === "user";
    });
  }, [systemUsers]);

  const totalSh = projectDetails?.total_shareholders ?? 0;
  const availSh = projectDetails?.available_share_count ?? (totalSh > 0 ? totalSh : 9999);
  const currentShExistingShares = initialData
    ? (initialData.share_type === "share_count" ? Number(initialData.share_count || 0) : (Number(initialData.ownership_pct || 0) / 100) * totalSh)
    : 0;

  const effectiveAvail = availSh + currentShExistingShares;
  const reqShares = v.share_type === "share_count"
    ? Number(v.share_count || 0)
    : (Number(v.ownership_pct || 0) / 100) * totalSh;

  const isOverCapacity = totalSh > 0 && reqShares > (effectiveAvail + 0.01);

  let calcPreview = "";
  if (v.share_type === "percentage" && totalSh > 0 && v.ownership_pct) {
    const cnt = ((Number(v.ownership_pct) / 100) * totalSh).toFixed(1);
    calcPreview = `= ${cnt} Shares (out of ${totalSh} total project shares)`;
  } else if (v.share_type === "share_count" && totalSh > 0 && v.share_count) {
    const pct = ((Number(v.share_count) / totalSh) * 100).toFixed(2);
    calcPreview = `= ${pct}% Equity (${v.share_count} of ${totalSh} total project shares)`;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        user_id: v.user_id ? Number(v.user_id) : null,
        name: v.name,
        email: v.email || null,
        phone: v.phone || null,
        share_type: v.share_type,
        ownership_pct: v.share_type === "percentage" ? (v.ownership_pct ? Number(v.ownership_pct) : 0) : 0,
        share_count: v.share_type === "share_count" ? (v.share_count ? Number(v.share_count) : 0) : 0,
        notes: v.notes || null,
      };

      if (initialData?.id) {
        await api.put(`/shareholders/${initialData.id}`, payload);
      } else {
        await api.post("/shareholders", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      toast.success(initialData ? "Shareholder updated" : "Shareholder added");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <DlgShell title={initialData ? "Edit shareholder" : "Add shareholder"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isOverCapacity) {
            toast.error(`Cannot allocate ${reqShares} shares. Project only has ${effectiveAvail} available shares remaining.`);
            return;
          }
          save.mutate();
        }}
        className="space-y-4"
      >
        {totalSh > 0 && (
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-gold flex items-center justify-between">
            <span className="font-medium flex items-center gap-1.5">
              <PieChart className="h-4 w-4" /> Share Capacity Status:
            </span>
            <span className="font-bold">
              {effectiveAvail <= 0 ? "0 Shares Left (FULL)" : `${effectiveAvail} Shares Available / ${totalSh} Total`}
            </span>
          </div>
        )}

        <Fld label="Link System User Account (Optional)">
          <select
            className="pi"
            value={v.user_id}
            onChange={(e) => {
              const uid = e.target.value;
              const matched = userRoleOptions.find((u: any) => String(u.id) === String(uid));
              setV({
                ...v,
                user_id: uid,
                name: matched ? (matched.full_name ?? matched.name) : v.name,
                email: matched ? matched.email : v.email,
                phone: matched ? (matched.phone || v.phone) : v.phone,
              });
            }}
          >
            <option value="">-- Custom Shareholder (No Login Account) --</option>
            {userRoleOptions.map((u: any) => (
              <option key={u.id} value={u.id} title={`${u.full_name ?? u.name} (${u.email})`}>
                {u.full_name ?? u.name} ({(u.email ?? "").split("@")[0]})
              </option>
            ))}
          </select>
        </Fld>

        <Fld label="Name">
          <input
            required
            className="pi"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Email">
            <input
              type="email"
              className="pi"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
            />
          </Fld>
          <Fld label="Phone">
            <input
              className="pi"
              value={v.phone}
              onChange={(e) => setV({ ...v, phone: e.target.value })}
            />
          </Fld>
        </div>

        {/* Share Purchase Type Selector */}
        <div className="rounded-lg border border-border bg-surface-2/60 p-3 space-y-2">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Share Package Type
          </span>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setV({ ...v, share_type: "percentage" })}
              className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                v.share_type === "percentage" ? "bg-gold text-slate-950 font-bold" : "bg-surface-1 text-muted-foreground"
              }`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setV({ ...v, share_type: "share_count" })}
              className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                v.share_type === "share_count" ? "bg-gold text-slate-950 font-bold" : "bg-surface-1 text-muted-foreground"
              }`}
            >
              Share Quantity (Qty)
            </button>
          </div>

          {v.share_type === "percentage" ? (
            <Fld label="Ownership Equity (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 25 (%)"
                className={`pi ${isOverCapacity ? "!border-destructive" : ""}`}
                value={v.ownership_pct}
                onChange={(e) => setV({ ...v, ownership_pct: e.target.value })}
              />
            </Fld>
          ) : (
            <Fld label="Number of Shares (e.g. 5, 2, 6)">
              <input
                type="number"
                min="0"
                placeholder="e.g. 5 (Shares)"
                className={`pi ${isOverCapacity ? "!border-destructive" : ""}`}
                value={v.share_count}
                onChange={(e) => setV({ ...v, share_count: e.target.value })}
              />
            </Fld>
          )}

          {isOverCapacity && (
            <div className="text-xs font-semibold text-destructive flex items-center gap-1.5 pt-1">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Over Capacity Error: Only {effectiveAvail} share(s) remaining out of {totalSh} total.</span>
            </div>
          )}

          {calcPreview && !isOverCapacity && (
            <div className="text-xs font-medium text-gold flex items-center gap-1.5 pt-1">
              <Wallet className="h-3.5 w-3.5" />
              <span>Smart Calculation Preview: {calcPreview}</span>
            </div>
          )}
        </div>

        <Fld label="Notes">
          <textarea
            className="pi min-h-[70px]"
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
          />
        </Fld>
        <SubmitBtn pending={save.isPending || isOverCapacity}>
          {initialData ? "Update shareholder" : "Add shareholder"}
        </SubmitBtn>
      </form>
    </DlgShell>
  );
}

function InvestmentDialog({
  projectId,
  shareholder,
  initialData,
  onClose,
}: {
  projectId: string;
  shareholder: { id: number | string; name: string };
  initialData?: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    amount: initialData?.amount ? String(initialData.amount) : "",
    date: initialData?.date ?? new Date().toISOString().slice(0, 10),
    note: initialData?.note ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        shareholder_id: shareholder.id,
        amount: Number(v.amount),
        date: v.date,
        note: v.note || null,
      };

      if (initialData?.id) {
        await api.put(`/shareholder-investments/${initialData.id}`, payload);
      } else {
        await api.post("/shareholder-investments", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholder_investments", projectId] });
      qc.invalidateQueries({ queryKey: ["reports", projectId] });
      toast.success(initialData ? "Investment updated" : "Investment recorded");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <DlgShell
      title={
        initialData
          ? `Edit investment · ${shareholder.name}`
          : `Log investment · ${shareholder.name}`
      }
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-4"
      >
        <Fld label="Amount (BDT)">
          <input
            required
            type="number"
            step="0.01"
            className="pi"
            value={v.amount}
            onChange={(e) => setV({ ...v, amount: e.target.value })}
          />
        </Fld>
        <Fld label="Date">
          <DatePicker
            value={v.date}
            onChange={(val) => setV({ ...v, date: val })}
            placeholder="Select date"
          />
        </Fld>
        <Fld label="Note">
          <textarea
            className="pi min-h-[70px]"
            value={v.note}
            onChange={(e) => setV({ ...v, note: e.target.value })}
          />
        </Fld>
        <SubmitBtn pending={save.isPending}>
          {initialData ? "Update investment" : "Save investment"}
        </SubmitBtn>
      </form>
    </DlgShell>
  );
}

function DlgShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitBtn({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
