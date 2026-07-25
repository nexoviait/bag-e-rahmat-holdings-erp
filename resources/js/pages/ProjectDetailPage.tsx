import React, { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { statusLabels, fmtBDT } from "@/lib/format";
import { useIsAdmin } from "@/lib/session";
import { DatePicker } from "@/components/DatePicker";
import { Loader2, Edit2, X, Wallet, Users } from "lucide-react";
import { toast } from "sonner";

import { OverviewTab } from "./project-tabs/OverviewTab";
import { FinancialTab } from "./project-tabs/FinancialTab";
import { ShareholdersTab } from "./project-tabs/ShareholdersTab";
import { ReportsTab } from "./project-tabs/ReportsTab";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const [openEdit, setOpenEdit] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const tabs = [
    { path: "", label: "Dashboard" },
    { path: "/revenue", label: "Revenue" },
    { path: "/expenses", label: "Expenses" },
    { path: "/shareholders", label: "Shareholders" },
    { path: "/payments", label: "Owner Payments" },
    { path: "/reports", label: "Reports" },
  ];

  if (isLoading)
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );

  if (!project)
    return (
      <div className="text-center text-muted-foreground py-12">
        Project not found or you don't have access.
      </div>
    );

  const base = `/projects/${projectId}`;
  const currentSubPath = location.pathname.replace(base, "");

  const renderActiveTab = () => {
    switch (currentSubPath) {
      case "/revenue":
        return <FinancialTab projectId={projectId!} kind="revenue" />;
      case "/expenses":
        return <FinancialTab projectId={projectId!} kind="expenses" />;
      case "/payments":
        return <FinancialTab projectId={projectId!} kind="payments" />;
      case "/shareholders":
        return <ShareholdersTab projectId={projectId!} />;
      case "/reports":
        return <ReportsTab projectId={projectId!} />;
      default:
        return <OverviewTab projectId={projectId!} />;
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-gold">
            <span>{project.code ?? "Project"}</span>
            <span>·</span>
            <span>{statusLabels[project.status]}</span>
            {project.total_shareholders > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                  <Users className="h-3 w-3 text-gold" />
                  {project.total_shareholders} Shareholders
                </span>
              </>
            )}
            {project.total_shareholder_project_price > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                  <Wallet className="h-3 w-3 text-gold" />
                  Total Shareholder Price: {fmtBDT(project.total_shareholder_project_price)}
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setOpenEdit(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5 text-gold" /> Edit Details
          </button>
        )}
      </div>

      <div className="mb-8 flex items-center gap-1 border-b border-border/60 overflow-x-auto no-scrollbar whitespace-nowrap">
        {tabs.map((t) => {
          const active =
            t.path === ""
              ? currentSubPath === "" || currentSubPath === "/"
              : currentSubPath === t.path;
          return (
            <Link
              key={t.label}
              to={`${base}${t.path}`}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition ${
                active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}
      </div>

      {renderActiveTab()}

      {openEdit && <EditProjectModal project={project} onClose={() => setOpenEdit(false)} />}
    </>
  );
}

function EditProjectModal({ project, onClose }: { project: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    name: project.name ?? "",
    code: project.code ?? "",
    description: project.description ?? "",
    status: project.status ?? "planning",
    total_shareholder_project_price: project.total_shareholder_project_price ?? "",
    total_shareholders: project.total_shareholders ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: v.name,
        code: v.code || null,
        description: v.description || null,
        status: v.status,
        total_shareholder_project_price: v.total_shareholder_project_price ? parseFloat(v.total_shareholder_project_price) : 0,
        total_shareholders: v.total_shareholders ? parseInt(v.total_shareholders, 10) : 0,
        start_date: v.start_date || null,
        end_date: v.end_date || null,
      };
      await api.put(`/projects/${project.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      toast.success("Project updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Edit project details</h3>
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
          <F label="Project name">
            <input
              required
              className="pi"
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Code">
              <input
                className="pi"
                value={v.code}
                onChange={(e) => setV({ ...v, code: e.target.value })}
                placeholder="PRJ-001"
              />
            </F>
            <F label="Status">
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
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Shareholder Price (৳)">
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
            <F label="Total Shareholders">
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
          <F label="Description">
            <textarea
              className="pi min-h-[70px]"
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Start date">
              <DatePicker
                value={v.start_date}
                onChange={(val) => setV({ ...v, start_date: val })}
                placeholder="Select start date"
              />
            </F>
            <F label="End date">
              <DatePicker
                value={v.end_date}
                onChange={(val) => setV({ ...v, end_date: val })}
                placeholder="Select end date"
              />
            </F>
          </div>
          <button
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update project
          </button>
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
