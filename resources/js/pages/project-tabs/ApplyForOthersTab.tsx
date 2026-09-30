import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate, fmtBDT } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import {
  Repeat,
  Tag,
  FileCheck2,
  X,
  Plus,
  Loader2,
  AlertCircle,
  UserRound,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { validateFile } from "@/lib/fileValidation";

const DOC_RULES = { extensions: ["pdf", "jpg", "jpeg", "png"], maxBytes: 20 * 1024 * 1024 };

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : status === "rejected"
      ? "bg-destructive/15 text-destructive"
      : "bg-gold/15 text-gold";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{status}</span>;
}

export function ApplyForOthersTab({ projectId }: { projectId: string }) {
  const canView = useHasPermission("applications.view");
  const [requestFor, setRequestFor] = useState<{ shareholder: any; kind: "transfer" | "sell" } | null>(null);
  const [showNoc, setShowNoc] = useState(false);

  const shareholders = useQuery({
    queryKey: ["shareholders", projectId],
    enabled: canView,
    queryFn: async () => (await api.get(`/shareholders?project_id=${projectId}`)).data as any[],
  });

  const list = shareholders.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold">Apply for Others</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share transfer, share sell and NOC requests. Submitted here, reviewed and approved from Administration.
        </p>
      </div>

      {!canView && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          Your role does not have permission to view this.
        </div>
      )}

      {canView && (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Repeat className="h-4 w-4 text-gold" /> Share Transfer &amp; Sell
            </h3>
            {shareholders.isLoading ? (
              <div className="noir-panel grid h-20 place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
              </div>
            ) : list.length === 0 ? (
              <div className="noir-panel px-4 py-8 text-center text-sm text-muted-foreground">
                No shareholder record found to submit a request for.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s: any) => (
                  <div key={s.id} className="noir-panel p-4">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0 text-gold" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(s.effective_ownership_pct ?? s.ownership_pct ?? 0)}% equity
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setRequestFor({ shareholder: s, kind: "transfer" })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                      >
                        <Repeat className="h-3.5 w-3.5" /> Transfer
                      </button>
                      <button
                        onClick={() => setRequestFor({ shareholder: s, kind: "sell" })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                      >
                        <Tag className="h-3.5 w-3.5" /> Sell
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                <FileCheck2 className="h-4 w-4 text-gold" /> NOC Requests
              </h3>
              <button
                onClick={() => setShowNoc(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> New NOC Request
              </button>
            </div>
            <NocList projectId={projectId} />
          </section>
        </div>
      )}

      {requestFor && (
        <ShareRequestModal
          shareholder={requestFor.shareholder}
          kind={requestFor.kind}
          onClose={() => setRequestFor(null)}
        />
      )}
      {showNoc && <NocRequestDialog projectId={projectId} onClose={() => setShowNoc(false)} />}
    </div>
  );
}

function NocList({ projectId }: { projectId: string }) {
  const requests = useQuery({
    queryKey: ["noc-requests", projectId],
    queryFn: async () => (await api.get(`/noc-requests?project_id=${projectId}`)).data as any[],
  });

  async function downloadDoc(id: number, name: string) {
    try {
      const res = await api.get(`/noc-requests/${id}/document`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download document");
    }
  }

  const list = requests.data ?? [];

  if (requests.isLoading) {
    return (
      <div className="noir-panel grid h-20 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }
  if (list.length === 0) {
    return <div className="noir-panel px-4 py-8 text-center text-sm text-muted-foreground">No NOC requests yet.</div>;
  }

  return (
    <div className="noir-panel overflow-hidden">
      <div className="divide-y divide-border/40">
        {list.map((n: any) => (
          <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{n.purpose}</div>
              <div className="text-xs text-muted-foreground">
                By {n.requested_by} · {fmtDate(n.created_at)}
                {n.status === "approved" && n.approved_by && <> · Approved by {n.approved_by}</>}
                {n.status === "rejected" && n.admin_notes && <> · {n.admin_notes}</>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={n.status} />
              {n.status === "approved" && n.document_name && (
                <button
                  onClick={() => downloadDoc(n.id, n.document_name)}
                  title="Download NOC"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NocRequestDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      await api.post("/noc-requests", { project_id: projectId, purpose: purpose.trim(), details: details.trim() || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noc-requests", projectId] });
      toast.success("NOC request submitted");
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">New NOC Request</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!purpose.trim()) {
              setError("Purpose is required.");
              return;
            }
            setError(null);
            submit.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Purpose (e.g. Bank loan, Visa)
            </span>
            <input className="pi" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Details (optional)
            </span>
            <textarea className="pi min-h-[80px]" value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {error && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            disabled={submit.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit request
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function ShareRequestModal({
  shareholder,
  kind,
  onClose,
}: {
  shareholder: any;
  kind: "transfer" | "sell";
  onClose: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const requests = useQuery({
    queryKey: ["share-requests", shareholder.id],
    queryFn: async () => (await api.get(`/share-requests?shareholder_id=${shareholder.id}`)).data as any[],
  });

  const list = (requests.data ?? []).filter((r: any) => r.kind === kind);
  const usingShareCount = shareholder.share_type === "share_count";
  const available = usingShareCount
    ? Number(shareholder.effective_share_count ?? shareholder.share_count ?? 0)
    : Number(shareholder.effective_ownership_pct ?? shareholder.ownership_pct ?? 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold">{kind === "transfer" ? "Share Transfer" : "Share Sell"}</h3>
            <p className="text-xs text-muted-foreground">
              For {shareholder.name} — {available} {usingShareCount ? "shares" : "% equity"} available
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {requests.isLoading ? (
          <div className="grid h-16 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-surface-2/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No {kind} requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-border/60 bg-surface-2 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">To {r.to_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.percentage != null ? `${r.percentage}%` : `${r.share_count} shares`}
                      {r.sale_price != null && <> · {fmtBDT(r.sale_price)}</>}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.reason && <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>}
              </div>
            ))}
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 py-2 text-sm font-medium text-gold transition hover:bg-gold hover:text-slate-950 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New {kind === "transfer" ? "transfer" : "sell"} request
          </button>
        )}

        {showForm && (
          <ShareRequestForm
            shareholder={shareholder}
            kind={kind}
            available={available}
            usingShareCount={usingShareCount}
            onDone={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function ShareRequestForm({
  shareholder,
  kind,
  available,
  usingShareCount,
  onDone,
  onCancel,
}: {
  shareholder: any;
  kind: "transfer" | "sell";
  available: number;
  usingShareCount: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function validate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!toName.trim()) errors.to_name = ["Recipient name is required."];
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      errors.amount = ["Enter a valid amount."];
    } else if (amt > available + 0.01) {
      errors.amount = [`Only ${available} ${usingShareCount ? "shares" : "%"} available.`];
    }
    if (kind === "sell" && (!salePrice || isNaN(Number(salePrice)) || Number(salePrice) < 0)) {
      errors.sale_price = ["Enter a valid sale price."];
    }
    return errors;
  }

  const submit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        shareholder_id: shareholder.id,
        kind,
        to_name: toName.trim(),
        to_email: toEmail.trim() || null,
        to_phone: toPhone.trim() || null,
        reason: reason.trim() || null,
      };
      if (usingShareCount) payload.share_count = Number(amount);
      else payload.percentage = Number(amount);
      if (kind === "sell") payload.sale_price = Number(salePrice);

      await api.post("/share-requests", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share-requests", shareholder.id] });
      toast.success(`${kind === "transfer" ? "Transfer" : "Sell"} request submitted — pending Super Admin approval`);
      onDone();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
        }
        setFieldErrors({});
        submit.mutate();
      }}
      className="mt-4 space-y-3 border-t border-border/60 pt-4"
    >
      <div className="text-xs text-muted-foreground">
        This is a request only — approval (Super Admin) is what actually moves the equity.
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {kind === "transfer" ? "Transfer to (name)" : "Buyer name"}
        </span>
        <input className="pi" value={toName} onChange={(e) => setToName(e.target.value)} />
        {fieldErrors.to_name && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{fieldErrors.to_name[0]}</span>
          </div>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email (optional)</span>
          <input type="email" className="pi" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone (optional)</span>
          <input className="pi" value={toPhone} onChange={(e) => setToPhone(e.target.value)} />
        </label>
      </div>

      <div className={`grid gap-3 ${kind === "sell" ? "grid-cols-2" : "grid-cols-1"}`}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {usingShareCount ? "Shares to move" : "Percentage to move"}
          </span>
          <input
            type="number"
            step={usingShareCount ? "1" : "0.01"}
            min="0.01"
            max={available}
            placeholder={`up to ${available}`}
            className="pi"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {fieldErrors.amount && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{fieldErrors.amount[0]}</span>
            </div>
          )}
        </label>
        {kind === "sell" && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Sale price (BDT)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="pi"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
            {fieldErrors.sale_price && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{fieldErrors.sale_price[0]}</span>
              </div>
            )}
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason (optional)</span>
        <textarea className="pi min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-accent cursor-pointer"
        >
          Cancel
        </button>
        <button
          disabled={submit.isPending}
          className="flex-[2] inline-flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
        >
          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit request
        </button>
      </div>
    </form>
  );
}
