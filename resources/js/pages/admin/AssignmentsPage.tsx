import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin } from "@/lib/session";
import { toast } from "sonner";
import { Check, Building2, Users, Shield, FolderKanban, LayoutGrid, Table, Search, CheckCircle2, Lock } from "lucide-react";

export function AssignmentsPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"cards" | "matrix">("cards");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["assignment-matrix"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/assignments");
      return res.data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      userId,
      projectId,
      on,
    }: {
      userId: number | string;
      projectId: number | string;
      on: boolean;
    }) => {
      await api.post("/admin/assignments/toggle", { user_id: userId, project_id: projectId, on });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success(variables.on ? "Project assigned to user" : "Project unassigned from user");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;

  const isAssigned = (uId: number | string, pId: number | string) =>
    !!(data?.assigns || []).find((a: any) => Number(a.user_id) === Number(uId) && Number(a.project_id) === Number(pId));

  const totalUsers = data?.users?.length ?? 0;
  const totalProjects = data?.projects?.length ?? 0;

  const filteredUsers = (data?.users ?? []).filter((u: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    );
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration / Settings"
        title="Project Access & Assignments"
        description="Manage project permissions by toggling user project assignments."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                viewMode === "cards" ? "bg-gold text-slate-950 font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> User Cards
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                viewMode === "matrix" ? "bg-gold text-slate-950 font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table className="h-3.5 w-3.5" /> Access Matrix
            </button>
          </div>
        }
      />

      <AdminNavTabs />

      {/* Overview Stats Bar */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="noir-panel p-4 flex items-center gap-3">
          <div className="rounded-lg bg-gold/10 p-2.5 text-gold border border-gold/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Users</div>
            <div className="font-display text-lg font-semibold">{totalUsers} User Accounts</div>
          </div>
        </div>

        <div className="noir-panel p-4 flex items-center gap-3">
          <div className="rounded-lg bg-gold/10 p-2.5 text-gold border border-gold/30">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Active Projects</div>
            <div className="font-display text-lg font-semibold">{totalProjects} Projects</div>
          </div>
        </div>

        <div className="noir-panel p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Permission System</div>
            <div className="text-xs text-muted-foreground font-medium mt-0.5">
              Super Admin & Admin see all projects automatically. User accounts see assigned projects.
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="mb-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter user accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-gold"
        />
      </div>

      {/* CARDS VIEW (DEFAULT) */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map((u: any) => {
            const isSuperAdmin = u.email === "admin@bage-rahmat.com" || Number(u.id) === 1 || (u.roles || []).includes("super_admin");
            const assignedCount = (data?.projects ?? []).filter((p: any) => isAssigned(u.id, p.id)).length;
            const userInitials = (u.full_name || u.email || "U")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            return (
              <div key={u.id} className="noir-panel p-5 flex flex-col justify-between hover:border-gold/50 transition-all shadow-md">
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center font-display font-bold text-sm">
                        {userInitials}
                      </div>
                      <div>
                        <div className="font-display font-semibold text-foreground flex items-center gap-1.5">
                          <span>{u.full_name ?? "—"}</span>
                          {isSuperAdmin && (
                            <span title="System Administrator (Universal Access)">
                              <Lock className="h-3 w-3 text-gold" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>

                    <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full border ${
                      isSuperAdmin
                        ? "bg-gold/20 text-gold border-gold/40"
                        : assignedCount > 0
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-surface-2 text-muted-foreground border-border"
                    }`}>
                      {isSuperAdmin ? "Universal Access" : `${assignedCount} / ${totalProjects} Projects`}
                    </span>
                  </div>

                  {/* Card Body - Project Assignment List */}
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Assigned Workspace Projects
                    </div>

                    {isSuperAdmin ? (
                      <div className="p-3 rounded-lg border border-gold/30 bg-gold/5 text-xs text-gold flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        <span>System Administrator has full access to all projects by default.</span>
                      </div>
                    ) : (
                      (data?.projects ?? []).map((p: any) => {
                        const on = isAssigned(u.id, p.id);

                        return (
                          <div
                            key={p.id}
                            onClick={() => toggle.mutate({ userId: u.id, projectId: p.id, on: !on })}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition cursor-pointer select-none ${
                              on
                                ? "border-gold/60 bg-gold/10 text-foreground"
                                : "border-border/60 bg-surface-1/60 hover:bg-surface-2/80 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <Building2 className={`h-4 w-4 flex-shrink-0 ${on ? "text-gold" : "text-muted-foreground"}`} />
                              <span className="text-xs font-medium truncate">{p.name}</span>
                              {p.code && (
                                <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-surface-2 text-muted-foreground border border-border/40">
                                  {p.code}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                                on
                                  ? "bg-gold text-slate-950 shadow-sm"
                                  : "bg-surface-2 text-muted-foreground border border-border/80 hover:border-gold/50"
                              }`}
                            >
                              {on ? (
                                <>
                                  <Check className="h-3 w-3 stroke-[3]" /> Assigned
                                </>
                              ) : (
                                "No Access"
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MATRIX TABLE VIEW */}
      {viewMode === "matrix" && (
        <div className="noir-panel overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm border-collapse">
              <thead className="border-b border-border/80 bg-surface-2">
                <tr>
                  <th className="sticky left-0 z-20 bg-surface-2 px-5 py-4 text-left text-[11px] uppercase tracking-widest text-muted-foreground font-semibold min-w-[240px] max-w-[280px] border-r border-border/60 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                    User Account
                  </th>
                  {data?.projects?.map((p: any) => (
                    <th
                      key={p.id}
                      className="px-4 py-4 text-center text-xs font-semibold text-foreground min-w-[180px] border-r border-border/30 last:border-r-0"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 text-gold font-display font-medium">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[160px]" title={p.name}>{p.name}</span>
                        </div>
                        {p.code && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono bg-surface-1 px-1.5 py-0.5 rounded border border-border/40">
                            {p.code}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="group hover:bg-surface-2/60 transition-colors">
                    <td className="sticky left-0 z-10 bg-background group-hover:bg-surface-2 px-5 py-3.5 min-w-[240px] max-w-[280px] border-r border-border/60 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                      <div className="font-medium text-foreground truncate max-w-[220px]">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]">{u.email}</div>
                    </td>
                    {data.projects.map((p: any) => {
                      const on = isAssigned(u.id, p.id);
                      return (
                        <td key={p.id} className="px-4 py-3.5 text-center min-w-[180px] border-r border-border/30 last:border-r-0">
                          <button
                            onClick={() =>
                              toggle.mutate({ userId: u.id, projectId: p.id, on: !on })
                            }
                            title={on ? `Assigned to ${p.name} (Click to unassign)` : `Click to assign to ${p.name}`}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${
                              on
                                ? "border-gold bg-gold text-slate-950 font-bold shadow-md shadow-gold/20 scale-105"
                                : "border-border/80 bg-surface-2/80 hover:border-gold hover:bg-gold/10 text-muted-foreground"
                            }`}
                          >
                            {on ? (
                              <Check className="h-5 w-5 stroke-[3]" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-muted-foreground/60 bg-muted-foreground/20" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
