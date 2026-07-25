import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { fmtBDT, statusLabels } from "@/lib/format";
import { useIsAdmin } from "@/lib/session";
import { ArrowRight, FolderKanban, Activity } from "lucide-react";

export function DashboardPage() {
  const isAdmin = useIsAdmin();

  const { data: projects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const res = await api.get("/projects");
      return res.data;
    },
  });

  const { data: totals } = useQuery({
    queryKey: ["dashboard-totals"],
    queryFn: async () => {
      const res = await api.get("/dashboard/totals");
      return res.data;
    },
  });

  const net =
    ((totals?.revenue ?? 0) + (totals?.investments ?? 0)) -
    ((totals?.expenses ?? 0) + (totals?.payments ?? 0));
  const activeCount = (projects ?? []).filter((p: any) => p.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Overview"
        description="A live snapshot across every project you have access to."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Budget"
          value={fmtBDT(totals?.budget)}
          hint={`${activeCount} active ${activeCount === 1 ? "project" : "projects"}`}
        />
        <StatCard label="Total Revenue" value={fmtBDT(totals?.revenue)} accent="green" />
        <StatCard label="Total Expenses" value={fmtBDT(totals?.expenses)} accent="red" />
        <StatCard
          label="Net Cash Balance"
          value={fmtBDT(net)}
          accent="gold"
          hint="Cash In (Rev+Invest) − Cash Out (Exp+Owner)"
        />
      </div>

      <div className={`mt-10 grid gap-8 ${isAdmin ? "lg:grid-cols-3" : ""}`}>
        <div className={isAdmin ? "lg:col-span-2" : ""}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">My projects</h2>
            <Link to="/projects" className="text-sm text-gold hover:underline">
              All projects →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects?.length === 0 && (
              <div className="noir-panel col-span-full p-10 text-center text-muted-foreground">
                No projects assigned yet.
              </div>
            )}
            {projects?.slice(0, 6).map((p: any) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="noir-panel group p-5 transition hover:border-gold/50"
              >
                <div className="flex items-start justify-between">
                  <FolderKanban className="h-5 w-5 text-gold" />
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {statusLabels[p.status] ?? p.status}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {p.description ?? "No description."}
                </p>
                <div className="mt-4 flex items-center text-xs text-gold">
                  Open workspace{" "}
                  <ArrowRight className="ml-1 h-3 w-3 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gold" />
              <h2 className="font-display text-xl font-semibold">Recent activity</h2>
            </div>
            <div className="noir-panel divide-y divide-border/40 overflow-hidden">
              {totals?.recentLogs?.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No recent activity.
                </div>
              ) : (
                totals?.recentLogs?.map((log: any) => (
                  <div key={log.id} className="p-3.5 text-xs">
                    <div className="font-medium text-foreground">{log.action}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{log.entity ?? "System"}</span>
                      <span>
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
