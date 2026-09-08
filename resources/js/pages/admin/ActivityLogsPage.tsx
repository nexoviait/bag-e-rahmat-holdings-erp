import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin } from "@/lib/session";
import { History, Building2, FileText, AlertTriangle, RefreshCw } from "lucide-react";

export function ActivityLogsPage() {
  const isAdmin = useIsAdmin();

  const { data: logs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-activity-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get("/admin/activity-logs");
      return res.data;
    },
  });

  if (!isAdmin) return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;

  return (
    <>
      <PageHeader
        eyebrow="Administration / Settings"
        title="System Activity Logs"
        description="Audit trail of recent system actions, project changes, investment logs, and administrative operations."
      />

      <AdminNavTabs />

      <div className="noir-panel overflow-hidden">
        <div className="border-b border-border/60 p-4 bg-surface-2 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-gold" />
            <span>Audit Trail & Activity Log</span>
          </div>
          {!isError && (
            <span className="text-xs text-muted-foreground">
              Showing latest {logs?.length ?? 0} events
            </span>
          )}
        </div>

        {isLoading && (
          <div className="px-5 py-12 text-center text-muted-foreground">Loading activity logs…</div>
        )}

        {isError && !isLoading && (
          <div className="px-5 py-12 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">Couldn't load activity logs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(error as any)?.response?.data?.message || "Something went wrong. Please try again."}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-gold" /> Retry
            </button>
          </div>
        )}

        {!isError && logs?.length === 0 && !isLoading && (
          <div className="px-5 py-12 text-center text-muted-foreground">No activity logs recorded yet.</div>
        )}

        {/* Mobile / tablet: card list */}
        {!isError && logs?.length > 0 && (
          <div className="divide-y divide-border/40 lg:hidden">
            {logs.map((l: any) => (
              <div key={l.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <span className="truncate">{l.project_name}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-2 border border-border/60 px-2 py-0.5 text-[11px] font-medium text-gold">
                    <FileText className="h-3 w-3" />
                    {l.entity}
                  </span>
                </div>
                <div className="mt-2 font-medium text-foreground">{l.action}</div>
                <div className="mt-1 text-xs text-muted-foreground font-mono">
                  {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop: table */}
        {!isError && logs?.length > 0 && (
          <div className="hidden overflow-x-auto no-scrollbar lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-surface-1 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Action Details</th>
                  <th className="px-5 py-3">Entity Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">
                      {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-gold" />
                        {l.project_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {l.action}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 border border-border/60 px-2 py-0.5 text-[11px] font-medium text-gold">
                        <FileText className="h-3 w-3" />
                        {l.entity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
