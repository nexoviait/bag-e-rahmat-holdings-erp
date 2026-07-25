import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { DatePicker } from "@/components/DatePicker";
import { useIsAdmin } from "@/lib/session";
import { statusLabels, fmtDate, fmtBDT } from "@/lib/format";
import { Plus, X, Loader2, Search, Edit2, Trash2, Filter, Building2, Wallet, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

export function ProjectsPage() {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const res = await api.get("/projects");
      return res.data;
    },
  });

  const filteredProjects = useMemo(() => {
    let list = projects ?? [];
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(
        (p: any) =>
          p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((p: any) => p.status === statusFilter);
    }
    return list;
  }, [projects, search, statusFilter]);

  const delProject = useMutation({
    mutationFn: async (p: any) => {
      await api.delete(`/projects/${p.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      qc.invalidateQueries({ queryKey: ["projects-all"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      toast.success("Project deleted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "planning":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "on_hold":
        return "bg-sky-500/15 text-sky-400 border-sky-500/30";
      case "completed":
        return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
      case "cancelled":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default:
        return "bg-surface-2 text-muted-foreground border-border";
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Every project you can access and manage."
        actions={
          isAdmin && (
            <button
              onClick={() => {
                setEditingProject(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold hover:opacity-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-12 items-center rounded-lg border border-border/60 bg-surface-1 p-3">
        <div className="relative sm:col-span-8 md:col-span-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search project by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-1.5 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-4 md:col-span-6 justify-end">
          <Filter className="h-4 w-4 text-gold" />
          <span className="text-xs text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-gold"
          >
            <option value="all">All Statuses</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-gold" />
          Loading projects...
        </div>
      )}

      {filteredProjects.length === 0 && !isLoading && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No projects found.
        </div>
      )}

      {/* Mobile / tablet: card list */}
      {filteredProjects.length > 0 && (
        <div className="grid gap-3 lg:hidden">
          {filteredProjects.map((p: any) => (
            <div key={p.id} className="noir-panel min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/projects/${p.id}`}
                  className="flex min-w-0 items-center gap-2 font-medium text-foreground hover:text-gold"
                >
                  <Building2 className="h-4 w-4 text-gold flex-shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider ${getStatusBadgeClass(p.status)}`}
                >
                  {statusLabels[p.status] ?? p.status}
                </span>
              </div>
              {p.code && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">{p.code}</div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Total Shares</div>
                  <div className="mt-0.5 truncate font-medium text-foreground">
                    {p.total_shareholders ? `${p.total_shareholders} Shares` : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Project Budget (৳)</div>
                  <div className="mt-0.5 truncate font-semibold gold-text">
                    {p.total_shareholder_project_price ? fmtBDT(p.total_shareholder_project_price) : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Start Date</div>
                  <div className="mt-0.5 truncate text-muted-foreground">{fmtDate(p.start_date)}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">End Date</div>
                  <div className="mt-0.5 truncate text-muted-foreground">{fmtDate(p.end_date)}</div>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/40 pt-3">
                  <button
                    onClick={() => {
                      setEditingProject(p);
                      setOpen(true);
                    }}
                    title="Edit project"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer transition"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      confirm(`Delete project "${p.name}"? This action cannot be undone.`) &&
                      delProject.mutate(p)
                    }
                    title="Delete project"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition"
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
      {filteredProjects.length > 0 && (
        <div className="noir-panel hidden overflow-hidden lg:block">
          <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3.5">Project Name</th>
                <th className="px-4 py-3.5">Code</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Total Shares</th>
                <th className="px-4 py-3.5">Project Budget (৳)</th>
                <th className="px-4 py-3.5">Start Date</th>
                <th className="px-4 py-3.5">End Date</th>
                {isAdmin && <th className="px-4 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p: any) => (
                <tr
                  key={p.id}
                  className="border-b border-border/40 last:border-0 transition hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-medium text-foreground hover:text-gold flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4 text-gold flex-shrink-0" />
                      <span>{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{p.code ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider ${getStatusBadgeClass(p.status)}`}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">
                    {p.total_shareholders ? `${p.total_shareholders} Shares` : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold gold-text">
                      {p.total_shareholder_project_price ? fmtBDT(p.total_shareholder_project_price) : "—"}
                    </div>
                    {p.per_share_price > 0 && (
                      <div className="text-[11px] text-muted-foreground font-normal">
                        {fmtBDT(p.per_share_price)} / Share
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">{fmtDate(p.start_date)}</td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">{fmtDate(p.end_date)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingProject(p);
                            setOpen(true);
                          }}
                          title="Edit project"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            confirm(`Delete project "${p.name}"? This action cannot be undone.`) &&
                            delProject.mutate(p)
                          }
                          title="Delete project"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition"
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
        <ProjectDialog
          initialData={editingProject}
          onClose={() => {
            setOpen(false);
            setEditingProject(null);
          }}
        />
      )}
    </>
  );
}

function ProjectDialog({ initialData, onClose }: { initialData?: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    name: initialData?.name ?? "",
    code: initialData?.code ?? "",
    description: initialData?.description ?? "",
    status: initialData?.status ?? "planning",
    total_shareholder_project_price: initialData?.total_shareholder_project_price ?? "",
    total_shareholders: initialData?.total_shareholders ?? "",
    start_date: initialData?.start_date ?? "",
    end_date: initialData?.end_date ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: v.name,
        description: v.description || null,
        status: v.status,
        total_shareholder_project_price: v.total_shareholder_project_price ? parseFloat(v.total_shareholder_project_price) : 0,
        total_shareholders: v.total_shareholders ? parseInt(v.total_shareholders, 10) : 0,
        start_date: v.start_date || null,
        end_date: v.end_date || null,
        code: v.code || null,
      };

      if (initialData?.id) {
        await api.put(`/projects/${initialData.id}`, payload);
      } else {
        await api.post("/projects", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      qc.invalidateQueries({ queryKey: ["projects-all"] });
      qc.invalidateQueries({ queryKey: ["assignment-matrix"] });
      qc.invalidateQueries({ queryKey: ["user-shareholders-edit"] });
      toast.success(initialData ? "Project updated successfully" : "Project created successfully");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const priceNum = parseFloat(v.total_shareholder_project_price || "0");
  const shCount = parseInt(v.total_shareholders || "0", 10);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-3xl p-6 md:p-8 max-h-[92vh] overflow-y-auto no-scrollbar shadow-elevated">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <h3 className="font-display text-xl font-semibold">
              {initialData ? "Edit project" : "New project"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter overall project details, budget allocations, and timeline dates.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-4"
        >
          <div className="md:col-span-8">
            <F label="Project Name">
              <input
                required
                className="pi"
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
                placeholder="e.g. Bag E Rahmat Commercial Hub"
              />
            </F>
          </div>

          <div className="md:col-span-4">
            <F label="Project Code">
              <input
                className="pi"
                value={v.code}
                onChange={(e) => setV({ ...v, code: e.target.value })}
                placeholder="e.g. BER-CH-01"
              />
            </F>
          </div>

          <div className="md:col-span-4">
            <F label="Project Status">
              <select
                className="pi"
                value={v.status}
                onChange={(e) => setV({ ...v, status: e.target.value })}
              >
                {Object.entries(statusLabels).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </F>
          </div>

          <div className="md:col-span-4">
            <F label="Project Budget (৳)">
              <input
                type="number"
                step="any"
                min="0"
                className="pi"
                value={v.total_shareholder_project_price}
                onChange={(e) => setV({ ...v, total_shareholder_project_price: e.target.value })}
                placeholder="e.g. 50000000"
              />
            </F>
          </div>

          <div className="md:col-span-4">
            <F label="Total Shareholders (Shares)">
              <input
                type="number"
                min="0"
                className="pi"
                value={v.total_shareholders}
                onChange={(e) => setV({ ...v, total_shareholders: e.target.value })}
                placeholder="e.g. 12"
              />
            </F>
          </div>

          {priceNum > 0 && shCount > 0 && (
            <div className="md:col-span-12 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-gold flex items-center justify-between animate-in fade-in duration-200">
              <span className="font-medium flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> Auto-Calculated Share Price:
              </span>
              <span className="font-bold font-display text-sm">
                {fmtBDT(priceNum / shCount)} / Share
              </span>
            </div>
          )}

          <div className="md:col-span-6">
            <F label="Start Date">
              <DatePicker
                value={v.start_date}
                onChange={(val) => setV({ ...v, start_date: val })}
                placeholder="Select start date"
              />
            </F>
          </div>

          <div className="md:col-span-6">
            <F label="End Date">
              <DatePicker
                value={v.end_date}
                onChange={(val) => setV({ ...v, end_date: val })}
                placeholder="Select end date"
              />
            </F>
          </div>

          <div className="md:col-span-12">
            <F label="Description">
              <textarea
                className="pi min-h-[80px]"
                value={v.description}
                onChange={(e) => setV({ ...v, description: e.target.value })}
                placeholder="Brief project details or notes..."
              />
            </F>
          </div>

          <div className="md:col-span-12 pt-2">
            <button
              disabled={save.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground shadow-gold hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialData ? "Update Project" : "Create Project"}
            </button>
          </div>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
