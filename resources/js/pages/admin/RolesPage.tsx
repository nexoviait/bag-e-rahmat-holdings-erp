import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin } from "@/lib/session";
import { roleLabels } from "@/lib/format";
import { toast } from "sonner";
import { Shield, Plus, Edit2, Trash2, X, Check, Lock, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export function RolesPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [expandedRoleIds, setExpandedRoleIds] = useState<Record<string | number, boolean>>({});

  const toggleExpand = (id: string | number) => {
    setExpandedRoleIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const { data: roles, isLoading } = useQuery({
    queryKey: ["all-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/roles");
      return res.data;
    },
  });

  const { data: allPermissions } = useQuery({
    queryKey: ["all-permissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/permissions");
      return res.data as string[];
    },
  });

  const togglePerm = useMutation({
    mutationFn: async ({
      roleId,
      permission,
      on,
    }: {
      roleId: number | string;
      permission: string;
      on: boolean;
    }) => {
      await api.post("/admin/roles/permissions", { role_id: roleId, permission, on });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Role permission updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const delRole = useMutation({
    mutationFn: async (roleId: number | string) => {
      await api.delete(`/admin/roles/${roleId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success("Role deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const groupedPermissions: Record<string, string[]> = {
    Projects: (allPermissions || []).filter((p) => p.startsWith("projects.")),
    Financials: (allPermissions || []).filter((p) => p.startsWith("financials.")),
    Shareholders: (allPermissions || []).filter((p) => p.startsWith("shareholders.")),
    Documents: (allPermissions || []).filter((p) => p.startsWith("documents.")),
    "CCTV Monitoring": (allPermissions || []).filter((p) => p.startsWith("cctv.")),
    Administration: (allPermissions || []).filter(
      (p) => p.startsWith("users.") || p.startsWith("reports.")
    ),
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration / Settings"
        title="Roles & Action Permissions"
        description="Manage application roles and assign granular action permissions to each role."
        actions={
          <button
            onClick={() => {
              setEditingRole(null);
              setOpenCreate(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Role
          </button>
        }
      />

      <AdminNavTabs />

      <div className="space-y-4">
        {isLoading && (
          <div className="noir-panel p-10 text-center text-muted-foreground">
            Loading roles and permissions...
          </div>
        )}

        {roles?.map((r: any) => {
          const rolePerms: string[] = r.permissions || [];
          const isSuperAdminRole = r.name === "super_admin";
          const isExpanded = !!expandedRoleIds[r.id];

          return (
            <div key={r.id} className="noir-panel overflow-hidden transition-all duration-200">
              <div
                onClick={() => toggleExpand(r.id)}
                className={`flex flex-wrap items-center justify-between gap-3 p-5 transition cursor-pointer hover:bg-surface-2/40 ${
                  isExpanded ? "border-b border-border/60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                      {roleLabels[r.name] ?? r.name.replace(/_/g, " ")}
                      {r.is_system && (
                        <span className="rounded-full bg-surface-2 border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          System Role
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {rolePerms.length} assigned action {rolePerms.length === 1 ? "permission" : "permissions"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!r.is_system && (
                    <div
                      className="flex items-center gap-1 mr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setEditingRole(r);
                          setOpenCreate(true);
                        }}
                        title="Edit role"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          confirm(`Delete custom role "${r.name}"?`) && delRole.mutate(r.id)
                        }
                        title="Delete role"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-gold transition">
                    <span>{isExpanded ? "Hide" : "Show permissions"}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gold" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-6 space-y-4 bg-surface-1/40 animate-in fade-in duration-200">
                  {Object.entries(groupedPermissions).map(([group, perms]) => (
                    <div key={group}>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {perms.map((p) => {
                          const hasPerm = rolePerms.includes(p);
                          const disabled = isSuperAdminRole;

                          return (
                            <button
                              key={p}
                              disabled={disabled}
                              onClick={() =>
                                !disabled && togglePerm.mutate({ roleId: r.id, permission: p, on: !hasPerm })
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                disabled
                                  ? "border-gold/40 bg-gold/10 text-gold cursor-not-allowed opacity-80"
                                  : hasPerm
                                  ? "border-gold bg-gold/20 text-gold hover:bg-gold/30 cursor-pointer"
                                  : "border-border bg-input text-muted-foreground hover:border-gold/50 hover:text-foreground cursor-pointer"
                              }`}
                            >
                              {disabled ? (
                                <Lock className="h-3 w-3 text-gold" />
                              ) : hasPerm ? (
                                <Check className="h-3 w-3 text-gold" />
                              ) : null}
                              <span>{p}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openCreate && (
        <RoleDialog
          initialData={editingRole}
          allPermissions={allPermissions || []}
          onClose={() => {
            setOpenCreate(false);
            setEditingRole(null);
          }}
        />
      )}
    </>
  );
}

function RoleDialog({
  initialData,
  allPermissions,
  onClose,
}: {
  initialData?: any | null;
  allPermissions: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialData?.name ?? "");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(initialData?.permissions ?? []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        permissions: selectedPerms,
      };

      if (initialData?.id) {
        await api.put(`/admin/roles/${initialData.id}`, payload);
      } else {
        await api.post("/admin/roles", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success(initialData ? "Role updated" : "Role created");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const togglePermSelect = (p: string) => {
    setSelectedPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">
            {initialData ? "Edit Role" : "Create New Role"}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
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
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role Name
            </span>
            <input
              required
              className="pi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Inspector"
            />
          </label>

          <div>
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Assign Actions & Permissions
            </span>
            <div className="flex flex-wrap gap-2">
              {allPermissions.map((p) => {
                const on = selectedPerms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePermSelect(p)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      on
                        ? "border-gold bg-gold/20 text-gold"
                        : "border-border bg-input text-muted-foreground hover:border-gold/50"
                    }`}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData ? "Update Role" : "Create Role"}
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}
