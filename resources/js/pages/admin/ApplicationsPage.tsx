import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin, useHasPermission } from "@/lib/session";
import { fmtDate, fmtBDT } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Loader2, AlertCircle, UploadCloud } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : status === "rejected"
      ? "bg-destructive/15 text-destructive"
      : "bg-gold/15 text-gold";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{status}</span>;
}

export function ApplicationsPage() {
  const isAdmin = useIsAdmin();
  const canApprove = useHasPermission("applications.approve");
  const [tab, setTab] = useState<"share" | "noc">("share");
  const [approvingNoc, setApprovingNoc] = useState<any | null>(null);
  const qc = useQueryClient();

  const shareRequests = useQuery({
    queryKey: ["all-share-requests"],
    enabled: isAdmin && tab === "share",
    queryFn: async () => (await api.get("/share-requests")).data as any[],
  });

  const nocRequests = useQuery({
    queryKey: ["all-noc-requests"],
    enabled: isAdmin && tab === "noc",
    queryFn: async () => (await api.get("/noc-requests")).data as any[],
  });

  const approveShare = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/share-requests/${id}/approve`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-share-requests"] });
      toast.success("Approved — ownership records updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const rejectShare = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/share-requests/${id}/reject`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-share-requests"] });
      toast.success("Request rejected");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const rejectNoc = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/noc-requests/${id}/reject`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-noc-requests"] });
      toast.success("Request rejected");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const shareList = shareRequests.data ?? [];
  const nocList = nocRequests.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Applications"
        description="Share Transfer/Sell and NOC requests submitted from projects' Apply for Others tab. Approving a share request immediately updates the shareholder's ownership records."
      />
      <AdminNavTabs />

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1 w-fit">
        <button
          onClick={() => setTab("share")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
            tab === "share" ? "bg-gold text-slate-950 font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Share Transfer / Sell
        </button>
        <button
          onClick={() => setTab("noc")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
            tab === "noc" ? "bg-gold text-slate-950 font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          NOC Requests
        </button>
      </div>

      {tab === "share" && (
        <div className="noir-panel overflow-hidden">
          {shareRequests.isLoading ? (
            <div className="grid h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : shareList.length === 0 ? (
            <div className="px-4 py-16 text-center text-muted-foreground">No share requests yet.</div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Sale Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shareList.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-3 capitalize">{r.kind}</td>
                      <td className="px-4 py-3 font-medium">{r.shareholder_name}</td>
                      <td className="px-4 py-3">
                        <div>{r.to_name}</div>
                        {r.to_email && <div className="text-xs text-muted-foreground">{r.to_email}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.project_name}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {r.percentage != null ? `${r.percentage}%` : `${r.share_count} shares`}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.sale_price != null ? fmtBDT(r.sale_price) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {r.status === "approved" && r.approved_by && (
                          <div className="mt-1 text-[11px] text-muted-foreground">by {r.approved_by}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(r.created_at)}
                        {r.created_by && <div className="text-xs text-muted-foreground/70">by {r.created_by}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "pending" && canApprove && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => confirm(`Approve this ${r.kind}? This immediately updates "${r.shareholder_name}"'s ownership records.`) && approveShare.mutate(r.id)}
                              title="Approve — updates ownership records"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-[color:var(--success)]/15 hover:text-[color:var(--success)] cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirm("Reject this request?") && rejectShare.mutate(r.id)}
                              title="Reject"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "noc" && (
        <div className="noir-panel overflow-hidden">
          {nocRequests.isLoading ? (
            <div className="grid h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : nocList.length === 0 ? (
            <div className="px-4 py-16 text-center text-muted-foreground">No NOC requests yet.</div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nocList.map((n: any) => (
                    <tr key={n.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{n.purpose}</div>
                        {n.details && <div className="text-xs text-muted-foreground line-clamp-1">{n.details}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{n.requested_by}</td>
                      <td className="px-4 py-3 text-muted-foreground">{n.project_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={n.status} />
                        {n.status === "approved" && n.approved_by && (
                          <div className="mt-1 text-[11px] text-muted-foreground">by {n.approved_by}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(n.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {n.status === "pending" && canApprove && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setApprovingNoc(n)}
                              title="Approve — upload the signed NOC"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-[color:var(--success)]/15 hover:text-[color:var(--success)] cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirm("Reject this NOC request?") && rejectNoc.mutate(n.id)}
                              title="Reject"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {approvingNoc && <ApproveNocDialog noc={approvingNoc} onClose={() => setApprovingNoc(null)} />}
    </>
  );
}

function ApproveNocDialog({ noc, onClose }: { noc: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("document", file as File);
      if (notes.trim()) formData.append("admin_notes", notes.trim());
      await api.post(`/noc-requests/${noc.id}/approve`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-noc-requests"] });
      toast.success("NOC approved and issued");
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Approve NOC — {noc.purpose}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              setError("Please upload the signed NOC document.");
              return;
            }
            setError(null);
            approve.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Signed NOC document</span>
            <label
              htmlFor="noc-doc-input"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-gold/50"
            >
              <UploadCloud className="h-4 w-4 shrink-0 text-gold" />
              <span className="min-w-0 truncate">{file ? file.name : "Choose PDF/image"}</span>
            </label>
            <input
              id="noc-doc-input"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</span>
            <textarea className="pi min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            disabled={approve.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Approve &amp; issue NOC
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}
