import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin, useHasPermission } from "@/lib/session";
import { fmtDate, fmtBDT } from "@/lib/format";
import { toast } from "sonner";
import { Check, Trash2, Edit2, X, Loader2, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";

export function NomineesPage() {
  const isAdmin = useIsAdmin();
  const canApprove = useHasPermission("nominees.approve");
  const canEdit = useHasPermission("nominees.edit");
  const canDelete = useHasPermission("nominees.delete");
  const qc = useQueryClient();
  const [editingNominee, setEditingNominee] = useState<any | null>(null);

  const nominees = useQuery({
    queryKey: ["all-nominees"],
    enabled: isAdmin,
    queryFn: async () => (await api.get("/nominees")).data as any[],
  });

  const approve = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/nominees/${id}/approve`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-nominees"] });
      toast.success("Nominee approved — their login is now active");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/nominees/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-nominees"] });
      toast.success("Nominee deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  async function downloadFile(id: number, kind: "nid" | "photo", filename: string) {
    try {
      const res = await api.get(`/nominees/${id}/${kind}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download file");
    }
  }

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const list = nominees.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Nominees"
        description="Shareholder-nominated representatives across every project. New nominees are added from a shareholder's own card on the Shareholders tab, and only take effect (get a working login) once approved here."
      />
      <AdminNavTabs />

      {nominees.isLoading ? (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">Loading…</div>
      ) : list.length === 0 ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No nominees have been submitted yet.
        </div>
      ) : (
        <div className="noir-panel overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nominee</th>
                  <th className="px-4 py-3">Shareholder</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3 text-right">Ownership</th>
                  <th className="px-4 py-3 text-right">Share Price</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((n: any) => (
                  <tr key={n.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{n.name}</div>
                      <div className="text-xs text-muted-foreground">{n.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{n.shareholder_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{n.project_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{n.ownership_percentage}%</td>
                    <td className="px-4 py-3 text-right font-medium text-gold">{fmtBDT(n.share_price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadFile(n.id, "nid", n.nid_name)}
                          title={`Download ${n.nid_name}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => downloadFile(n.id, "photo", n.photo_name)}
                          title={`Download ${n.photo_name}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          n.status === "approved"
                            ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                            : "bg-gold/15 text-gold"
                        }`}
                      >
                        {n.status}
                      </span>
                      {n.status === "approved" && (
                        <div className="mt-1 text-[11px] text-muted-foreground">by {n.approved_by}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(n.created_at)}
                      {n.created_by && <div className="text-xs text-muted-foreground/70">by {n.created_by}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {n.status === "pending" && canApprove && (
                          <button
                            onClick={() => approve.mutate(n.id)}
                            disabled={approve.isPending}
                            title="Approve — activates their login"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-[color:var(--success)]/15 hover:text-[color:var(--success)] cursor-pointer disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => setEditingNominee(n)}
                            title="Edit"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => confirm(`Delete nominee "${n.name}"? This also removes their login account.`) && del.mutate(n.id)}
                            title="Delete"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingNominee && (
        <EditNomineeDialog nominee={editingNominee} onClose={() => setEditingNominee(null)} />
      )}
    </>
  );
}

function EditNomineeDialog({ nominee, onClose }: { nominee: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(nominee.name ?? "");
  const [email, setEmail] = useState(nominee.email ?? "");
  const [phone, setPhone] = useState(nominee.phone ?? "");
  const [ownershipPercentage, setOwnershipPercentage] = useState(String(nominee.ownership_percentage ?? ""));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/nominees/${nominee.id}`, {
        name,
        email,
        phone: phone || null,
        ownership_percentage: Number(ownershipPercentage),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-nominees"] });
      toast.success("Nominee updated");
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Edit nominee</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</span>
            <input required className="pi" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</span>
            <input required type="email" className="pi" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</span>
            <input className="pi" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ownership percentage
            </span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              className="pi"
              value={ownershipPercentage}
              onChange={(e) => setOwnershipPercentage(e.target.value)}
            />
          </label>
          {error && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}
