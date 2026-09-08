import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin } from "@/lib/session";
import { roleLabels, fmtBDT } from "@/lib/format";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Plus, X, Loader2, Lock, AlertCircle, Trash2, PieChart, Wallet, Edit2 } from "lucide-react";

export function UsersPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/users");
      return res.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["all-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/roles");
      return res.data as { id: number; name: string }[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: number | string; role: string; on: boolean }) => {
      await api.post("/admin/users/role", { user_id: userId, role, on });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success("User role updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: number | string; is_active: boolean }) => {
      await api.post("/admin/users/status", { id, is_active });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success("User status updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const delUser = useMutation({
    mutationFn: async (id: number | string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success("User account deleted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const roleList = roles?.map((r) => r.name) ?? ["super_admin", "admin", "user"];

  return (
    <>
      <PageHeader
        eyebrow="Administration / Settings"
        title="Users & Spatie Roles"
        description="Manage workspace user accounts and assign application roles."
        actions={
          <button
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create User
          </button>
        }
      />

      <AdminNavTabs />

      {/* Mobile / tablet: card list */}
      <div className="grid gap-3 lg:hidden">
        {users?.map((u: any) => {
          const isPrimarySuperAdmin = u.email === "admin@bage-rahmat.com" || Number(u.id) === 1;

          return (
            <div key={u.id} className="noir-panel min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="truncate">{u.full_name ?? "—"}</span>
                    {isPrimarySuperAdmin && (
                      <span title="Primary Super Admin Account">
                        <Lock className="h-3 w-3 shrink-0 text-gold" />
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <button
                  disabled={isPrimarySuperAdmin}
                  title={isPrimarySuperAdmin ? "Primary Super Admin account cannot be deactivated" : undefined}
                  onClick={() => !isPrimarySuperAdmin && toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                    isPrimarySuperAdmin
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)] cursor-not-allowed opacity-80"
                      : u.is_active
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)] cursor-pointer"
                      : "bg-destructive/15 text-destructive cursor-pointer"
                  }`}
                >
                  {u.is_active ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                  {u.is_active ? "Active" : "Deactivated"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1 border-t border-border/40 pt-3">
                {roleList.map((r) => {
                  const on = (u.roles || []).includes(r);
                  const isRoleLocked = isPrimarySuperAdmin && r === "super_admin";
                  const label = roleLabels[r] ?? r.replace(/_/g, " ");

                  return (
                    <button
                      key={r}
                      disabled={isRoleLocked}
                      title={isRoleLocked ? "Primary Super Admin access cannot be removed" : undefined}
                      onClick={() => !isRoleLocked && setRole.mutate({ userId: u.id, role: r, on: !on })}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                        isRoleLocked
                          ? "border-gold bg-gold/20 text-gold cursor-not-allowed opacity-80"
                          : on
                          ? "border-gold/60 bg-gold/10 text-gold cursor-pointer"
                          : "border-border text-muted-foreground hover:border-gold/40 cursor-pointer"
                      }`}
                    >
                      {isRoleLocked && <Lock className="h-2.5 w-2.5" />}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-end border-t border-border/40 pt-3">
                {isPrimarySuperAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 italic" title="Default System Administrator cannot be edited or deleted">
                    <Lock className="h-3 w-3 text-gold" /> System Default
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingUser(u)}
                      title="Edit user account"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => confirm(`Are you sure you want to delete user account "${u.full_name}"?`) && delUser.mutate(u.id)}
                      title="Delete user account"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
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
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => {
              const isPrimarySuperAdmin = u.email === "admin@bage-rahmat.com" || Number(u.id) === 1;

              return (
                <tr
                  key={u.id}
                  className="border-b border-border/40 last:border-0 hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-1.5">
                      {u.full_name ?? "—"}
                      {isPrimarySuperAdmin && (
                        <span title="Primary Super Admin Account">
                          <Lock className="h-3 w-3 text-gold" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {roleList.map((r) => {
                        const on = (u.roles || []).includes(r);
                        const isRoleLocked = isPrimarySuperAdmin && r === "super_admin";
                        const label = roleLabels[r] ?? r.replace(/_/g, " ");

                        return (
                          <button
                            key={r}
                            disabled={isRoleLocked}
                            title={isRoleLocked ? "Primary Super Admin access cannot be removed" : undefined}
                            onClick={() => !isRoleLocked && setRole.mutate({ userId: u.id, role: r, on: !on })}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                              isRoleLocked
                                ? "border-gold bg-gold/20 text-gold cursor-not-allowed opacity-80"
                                : on
                                ? "border-gold/60 bg-gold/10 text-gold cursor-pointer"
                                : "border-border text-muted-foreground hover:border-gold/40 cursor-pointer"
                            }`}
                          >
                            {isRoleLocked && <Lock className="h-2.5 w-2.5" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={isPrimarySuperAdmin}
                      title={isPrimarySuperAdmin ? "Primary Super Admin account cannot be deactivated" : undefined}
                      onClick={() => !isPrimarySuperAdmin && toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                        isPrimarySuperAdmin
                          ? "bg-[color:var(--success)]/15 text-[color:var(--success)] cursor-not-allowed opacity-80"
                          : u.is_active
                          ? "bg-[color:var(--success)]/15 text-[color:var(--success)] cursor-pointer"
                          : "bg-destructive/15 text-destructive cursor-pointer"
                      }`}
                    >
                      {u.is_active ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                      {u.is_active ? "Active" : "Deactivated"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isPrimarySuperAdmin ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 italic" title="Default System Administrator cannot be edited or deleted">
                        <Lock className="h-3 w-3 text-gold" /> System Default
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(u)}
                          title="Edit user account"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirm(`Are you sure you want to delete user account "${u.full_name}"?`) && delUser.mutate(u.id)}
                          title="Delete user account"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {openCreate && (
        <CreateUserModal
          roles={roleList}
          onClose={() => setOpenCreate(false)}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </>
  );
}

interface ShareAlloc {
  project_id: string;
  share_type: "percentage" | "share_count";
  ownership_pct: string;
  share_count: string;
}

function CreateUserModal({ roles, onClose }: { roles: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<string>(roles[0] ?? "user");
  const [allocations, setAllocations] = useState<ShareAlloc[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: projects } = useQuery({
    queryKey: ["projects-for-alloc"],
    queryFn: async () => {
      const res = await api.get("/projects");
      return res.data;
    },
  });

  const addAllocationRow = () => {
    if (!projects || projects.length === 0) return;
    setAllocations([
      ...allocations,
      {
        project_id: String(projects[0].id),
        share_type: "percentage",
        ownership_pct: "10",
        share_count: "",
      },
    ]);
  };

  const removeAllocationRow = (idx: number) => {
    setAllocations(allocations.filter((_, i) => i !== idx));
  };

  const updateAllocation = (idx: number, patch: Partial<ShareAlloc>) => {
    const next = [...allocations];
    next[idx] = { ...next[idx], ...patch };
    setAllocations(next);
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: fullName,
        email,
        password,
        role,
      };

      if (role === "user" && allocations.length > 0) {
        payload.share_allocations = allocations.map((a) => ({
          project_id: Number(a.project_id),
          share_type: a.share_type,
          ownership_pct: a.ownership_pct ? Number(a.ownership_pct) : 0,
          share_count: a.share_count ? Number(a.share_count) : 0,
        }));
      }

      await api.post("/admin/users", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      toast.success(`User ${fullName} created successfully`);
      onClose();
    },
    onError: (e: any) => {
      const errs = e.response?.data?.errors;
      if (errs) {
        const formatted: Record<string, string> = {};
        if (errs.full_name) formatted.fullName = errs.full_name[0];
        if (errs.email) formatted.email = errs.email[0];
        if (errs.password) formatted.password = errs.password[0];
        setErrors(formatted);
      }
      toast.error(e.response?.data?.message || e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrs: Record<string, string> = {};

    if (!fullName.trim()) newErrs.fullName = "Full name is required.";
    if (!email.trim()) {
      newErrs.email = "Email address is required.";
    }

    if (!password) {
      newErrs.password = "Password is required.";
    }

    if (password !== confirmPassword) {
      newErrs.confirmPassword = "Passwords do not match. Please retype password correctly.";
    }

    if (Object.keys(newErrs).length > 0) {
      setErrors(newErrs);
      return;
    }

    setErrors({});
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="font-display text-xl font-semibold">Create user account</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Full Name" error={errors.fullName}>
            <input
              className={`pi ${errors.fullName ? "!border-destructive" : ""}`}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
              }}
              placeholder="e.g. Tariq Hasan"
            />
          </Field>

          <Field label="Email Address" error={errors.email}>
            <input
              type="text"
              className={`pi ${errors.email ? "!border-destructive" : ""}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              placeholder="tariq@company.com"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" error={errors.password}>
              <input
                type="password"
                className={`pi ${errors.password ? "!border-destructive" : ""}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="Password (min 6 chars)"
              />
            </Field>

            <Field label="Retype Password" error={errors.confirmPassword}>
              <input
                type="password"
                className={`pi ${errors.confirmPassword ? "!border-destructive" : ""}`}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                }}
                placeholder="Confirm password"
              />
            </Field>
          </div>

          <Field label="Initial Role" error={errors.role}>
            <select className="pi" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r] ?? r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>

          {/* Smart Share Purchase / Allocation Section for User Role */}
          {role === "user" && (
            <div className="rounded-lg border border-gold/40 bg-surface-2/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                    <PieChart className="h-4 w-4 text-gold" />
                    Shareholder Project Allocations
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Assign 1 or multiple project shares (Percentage or Share Quantity).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addAllocationRow}
                  className="inline-flex items-center gap-1 rounded-md bg-gold/20 border border-gold/50 px-2.5 py-1 text-xs font-medium text-gold hover:bg-gold/30 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Share Purchase
                </button>
              </div>

              {allocations.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-md">
                  No share purchases added yet. Click "+ Add Share Purchase" above to assign project shares.
                </div>
              )}

              {allocations.map((a, idx) => {
                const pObj = (projects ?? []).find((pr: any) => String(pr.id) === String(a.project_id));
                const totalSh = pObj?.total_shareholders ?? 0;
                const availSh = pObj?.available_share_count ?? (totalSh > 0 ? totalSh : 9999);
                const reqShares = a.share_type === "share_count"
                  ? Number(a.share_count || 0)
                  : (Number(a.ownership_pct || 0) / 100) * totalSh;
                const isOverCap = totalSh > 0 && reqShares > (availSh + 0.01);

                let calcEquivalent = "";
                if (a.share_type === "percentage" && totalSh > 0 && a.ownership_pct) {
                  const cnt = ((Number(a.ownership_pct) / 100) * totalSh).toFixed(1);
                  calcEquivalent = `= ${cnt} Shares (out of ${totalSh} total project shares)`;
                } else if (a.share_type === "share_count" && totalSh > 0 && a.share_count) {
                  const pct = ((Number(a.share_count) / totalSh) * 100).toFixed(2);
                  calcEquivalent = `= ${pct}% Equity (${a.share_count} of ${totalSh} total project shares)`;
                }

                return (
                  <div key={idx} className="Noir-panel bg-surface-1 p-3 rounded-md border border-border/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        className="pi text-xs !py-1"
                        value={a.project_id}
                        onChange={(e) => updateAllocation(idx, { project_id: e.target.value })}
                      >
                        {(projects ?? []).map((p: any) => {
                          const totalShP = p.total_shareholders ?? 0;
                          const availP = p.available_share_count ?? (totalShP > 0 ? totalShP : 999);
                          let label = p.name;
                          if (totalShP > 0) {
                            label += availP <= 0
                              ? ` (${totalShP}/${totalShP} Shares Allocated - FULL)`
                              : ` (${availP} Shares Available / ${totalShP} Total)`;
                          }
                          return (
                            <option key={p.id} value={p.id} disabled={availP <= 0 && String(p.id) !== String(a.project_id)}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAllocationRow(idx)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer"
                        title="Remove allocation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateAllocation(idx, { share_type: "percentage" })}
                          className={`flex-1 py-1 text-[11px] font-medium transition cursor-pointer ${
                            a.share_type === "percentage" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Percentage (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAllocation(idx, { share_type: "share_count" })}
                          className={`flex-1 py-1 text-[11px] font-medium transition cursor-pointer ${
                            a.share_type === "share_count" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Share Quantity (Qty)
                        </button>
                      </div>

                      {a.share_type === "percentage" ? (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="e.g. 25 (%)"
                            className={`pi text-xs !py-1 pr-6 ${isOverCap ? "!border-destructive" : ""}`}
                            value={a.ownership_pct}
                            onChange={(e) => updateAllocation(idx, { ownership_pct: e.target.value })}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">%</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 5 (Shares)"
                            className={`pi text-xs !py-1 ${isOverCap ? "!border-destructive" : ""}`}
                            value={a.share_count}
                            onChange={(e) => updateAllocation(idx, { share_count: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {isOverCap && (
                      <div className="text-[11px] font-semibold text-destructive flex items-center gap-1.5 pt-1 border-t border-destructive/40">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Capacity Error: "{pObj?.name}" has only {availSh} shares remaining out of {totalSh} total.</span>
                      </div>
                    )}

                    {calcEquivalent && !isOverCap && (
                      <div className="text-[11px] font-medium text-gold flex items-center gap-1 pt-1 border-t border-border/40">
                        <Wallet className="h-3 w-3" />
                        <span>Smart Calculation Preview: {calcEquivalent}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            disabled={create.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create User Account
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [allocations, setAllocations] = useState<ShareAlloc[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: projects } = useQuery({
    queryKey: ["projects-for-alloc-edit"],
    queryFn: async () => {
      const res = await api.get("/projects");
      return res.data;
    },
  });

  const { data: userShareholders } = useQuery({
    queryKey: ["user-shareholders-edit", user.id],
    queryFn: async () => {
      const res = await api.get(`/shareholders?user_id=${user.id}`);
      return res.data;
    },
  });

  useEffect(() => {
    if (userShareholders && Array.isArray(userShareholders)) {
      setAllocations(
        userShareholders.map((sh: any) => ({
          project_id: String(sh.project_id),
          share_type: sh.share_type ?? "percentage",
          ownership_pct: sh.ownership_pct ? String(sh.ownership_pct) : "",
          share_count: sh.share_count ? String(sh.share_count) : "",
        }))
      );
    }
  }, [userShareholders]);

  const addAllocationRow = () => {
    if (!projects || projects.length === 0) return;
    setAllocations([
      ...allocations,
      {
        project_id: String(projects[0].id),
        share_type: "percentage",
        ownership_pct: "10",
        share_count: "",
      },
    ]);
  };

  const removeAllocationRow = (idx: number) => {
    setAllocations(allocations.filter((_, i) => i !== idx));
  };

  const updateAllocation = (idx: number, patch: Partial<ShareAlloc>) => {
    const next = [...allocations];
    next[idx] = { ...next[idx], ...patch };
    setAllocations(next);
  };

  const update = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: fullName,
        email,
        share_allocations: allocations.map((a) => ({
          project_id: Number(a.project_id),
          share_type: a.share_type,
          ownership_pct: a.ownership_pct ? Number(a.ownership_pct) : 0,
          share_count: a.share_count ? Number(a.share_count) : 0,
        })),
      };
      if (password) payload.password = password;
      await api.put(`/admin/users/${user.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      toast.success(`User ${fullName} updated successfully`);
      onClose();
    },
    onError: (e: any) => {
      const errs = e.response?.data?.errors;
      if (errs) {
        const formatted: Record<string, string> = {};
        if (errs.full_name) formatted.fullName = errs.full_name[0];
        if (errs.email) formatted.email = errs.email[0];
        if (errs.password) formatted.password = errs.password[0];
        setErrors(formatted);
      }
      toast.error(e.response?.data?.message || e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrs: Record<string, string> = {};
    if (!fullName.trim()) newErrs.fullName = "Full name is required.";
    if (!email.trim()) newErrs.email = "Email address is required.";

    if (Object.keys(newErrs).length > 0) {
      setErrors(newErrs);
      return;
    }

    setErrors({});
    update.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="font-display text-xl font-semibold">Edit user account</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Full Name" error={errors.fullName}>
            <input
              className={`pi ${errors.fullName ? "!border-destructive" : ""}`}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
              }}
              placeholder="Full name"
            />
          </Field>

          <Field label="Email Address" error={errors.email}>
            <input
              type="email"
              className={`pi ${errors.email ? "!border-destructive" : ""}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              placeholder="user@example.com"
            />
          </Field>

          <Field label="New Password (Optional)" error={errors.password}>
            <input
              type="password"
              className={`pi ${errors.password ? "!border-destructive" : ""}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder="Leave blank to keep current password"
            />
          </Field>

          {/* Smart Shareholder Project Allocations Section */}
          <div className="rounded-lg border border-gold/40 bg-surface-2/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <PieChart className="h-4 w-4 text-gold" />
                  Shareholder Project Allocations
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Manage or update project shares (Percentage or Share Quantity) for this user.
                </div>
              </div>
              <button
                type="button"
                onClick={addAllocationRow}
                className="inline-flex items-center gap-1 rounded-md bg-gold/20 border border-gold/50 px-2.5 py-1 text-xs font-medium text-gold hover:bg-gold/30 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Share Purchase
              </button>
            </div>

            {allocations.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-md">
                No share purchases assigned to this user yet. Click "+ Add Share Purchase" above to assign.
              </div>
            )}

            {allocations.map((a, idx) => {
              const pObj = (projects ?? []).find((pr: any) => String(pr.id) === String(a.project_id));
              const totalSh = pObj?.total_shareholders ?? 0;
              let calcEquivalent = "";

              if (a.share_type === "percentage" && totalSh > 0 && a.ownership_pct) {
                const cnt = ((Number(a.ownership_pct) / 100) * totalSh).toFixed(1);
                calcEquivalent = `= ${cnt} Shares (out of ${totalSh} total project shares)`;
              } else if (a.share_type === "share_count" && totalSh > 0 && a.share_count) {
                const pct = ((Number(a.share_count) / totalSh) * 100).toFixed(2);
                calcEquivalent = `= ${pct}% Equity (${a.share_count} of ${totalSh} total project shares)`;
              }

              return (
                <div key={idx} className="Noir-panel bg-surface-1 p-3 rounded-md border border-border/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      className="pi text-xs !py-1"
                      value={a.project_id}
                      onChange={(e) => updateAllocation(idx, { project_id: e.target.value })}
                    >
                      {(projects ?? []).map((p: any) => {
                        const totalSh = p.total_shareholders ?? 0;
                        const avail = p.available_share_count ?? (totalSh > 0 ? totalSh : 999);
                        let label = p.name;
                        if (totalSh > 0) {
                          label += avail <= 0
                            ? ` (${totalSh}/${totalSh} Shares Allocated - FULL)`
                            : ` (${avail} Shares Available / ${totalSh} Total)`;
                        }
                        return (
                          <option key={p.id} value={p.id} disabled={avail <= 0 && String(p.id) !== String(a.project_id)}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAllocationRow(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer"
                      title="Remove allocation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div className="flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateAllocation(idx, { share_type: "percentage" })}
                        className={`flex-1 py-1 text-[11px] font-medium transition cursor-pointer ${
                          a.share_type === "percentage" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                        }`}
                      >
                        Percentage (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAllocation(idx, { share_type: "share_count" })}
                        className={`flex-1 py-1 text-[11px] font-medium transition cursor-pointer ${
                          a.share_type === "share_count" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                        }`}
                      >
                        Share Quantity (Qty)
                      </button>
                    </div>

                    {a.share_type === "percentage" ? (
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="e.g. 25 (%)"
                          className="pi text-xs !py-1 pr-6"
                          value={a.ownership_pct}
                          onChange={(e) => updateAllocation(idx, { ownership_pct: e.target.value })}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">%</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 5 (Shares)"
                          className="pi text-xs !py-1"
                          value={a.share_count}
                          onChange={(e) => updateAllocation(idx, { share_count: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {calcEquivalent && (
                    <div className="text-[11px] font-medium text-gold flex items-center gap-1 pt-1 border-t border-border/40">
                      <Wallet className="h-3 w-3" />
                      <span>Smart Calculation Preview: {calcEquivalent}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            disabled={update.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in duration-200">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
