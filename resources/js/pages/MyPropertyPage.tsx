import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate, fmtBDT } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import {
  Landmark,
  Plus,
  X,
  Loader2,
  FileText,
  AlertCircle,
  Trash2,
  Tag,
  HandCoins,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { validateFile } from "@/lib/fileValidation";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";

const DOC_RULES = { extensions: ["pdf", "jpg", "jpeg", "png"], maxBytes: 20 * 1024 * 1024 };
const TYPE_LABELS: Record<string, string> = { land: "Land", flat: "Flat", building: "Building", other: "Other" };

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    owned: "Owned",
    for_sale: "For Sale",
    offered_for_development: "Offered for Development",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  const cls =
    status === "for_sale" || status === "approved"
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : status === "offered_for_development"
      ? "bg-blue-500/15 text-blue-500"
      : status === "rejected"
      ? "bg-destructive/15 text-destructive"
      : status === "pending"
      ? "bg-gold/15 text-gold"
      : "bg-surface-2 text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function MyPropertyPage() {
  const canCreate = useHasPermission("properties.create");
  const [showForm, setShowForm] = useState(false);
  const [openProperty, setOpenProperty] = useState<any | null>(null);

  const properties = useQuery({
    queryKey: ["my-properties"],
    queryFn: async () => (await api.get("/properties")).data as any[],
  });

  const list = properties.data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-gold" />
            <h1 className="font-display text-2xl font-semibold">My Property</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal property records — private to you. Request a sale or offer a property to the company here.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Property
          </button>
        )}
      </div>

      {properties.isLoading ? (
        <div className="noir-panel grid h-24 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : list.length === 0 ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No property added yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setOpenProperty(p)}
              className="noir-panel p-4 text-left transition hover:border-gold/50 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{TYPE_LABELS[p.type] ?? p.type}</span>
                {p.estimated_value != null && <span>{fmtBDT(Number(p.estimated_value))}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && <AddPropertyDialog onClose={() => setShowForm(false)} />}
      {openProperty && (
        <PropertyDetailModal propertyId={openProperty.id} onClose={() => setOpenProperty(null)} />
      )}
    </div>
  );
}

function AddPropertyDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("land");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [docs, setDocs] = useState<{ label: string; file: File | null }[]>([{ label: "Deed", file: null }]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function updateDoc(i: number, patch: Partial<{ label: string; file: File | null }>) {
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDocRow() {
    setDocs((prev) => [...prev, { label: "", file: null }]);
  }
  function removeDocRow(i: number) {
    setDocs((prev) => prev.filter((_, idx) => idx !== i));
  }

  const submit = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("type", type);
      fd.append("location", location.trim());
      if (description.trim()) fd.append("description", description.trim());
      if (estimatedValue) fd.append("estimated_value", estimatedValue);
      docs
        .filter((d) => d.file)
        .forEach((d) => {
          fd.append("documents[]", d.file as File);
          fd.append("labels[]", d.label.trim() || "Document");
        });
      await api.post("/properties", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-properties"] });
      toast.success("Property added");
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors) setFieldErrors(errors);
      setError(e.response?.data?.message || e.message);
    },
  });

  function handleFilePick(i: number, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const err = validateFile(file, DOC_RULES);
    if (err) {
      toast.error(err);
      input.value = "";
      return;
    }
    updateDoc(i, { file });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Add Property</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !location.trim()) {
              setError("Title and location are required.");
              return;
            }
            setError(null);
            setFieldErrors({});
            submit.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Property title
            </span>
            <input className="pi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Land at Gazipur" />
            {fieldErrors.title && <FieldError msg={fieldErrors.title[0]} />}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</span>
              <select className="pi" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="land">Land</option>
                <option value="flat">Flat</option>
                <option value="building">Building</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estimated value (BDT, optional)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="pi"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</span>
            <input className="pi" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Gazipur Sadar" />
            {fieldErrors.location && <FieldError msg={fieldErrors.location[0]} />}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description (optional)
            </span>
            <textarea className="pi min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documents (optional — deed, tax receipt, photo, etc.)
            </span>
            <div className="space-y-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="pi flex-1"
                    placeholder="Label e.g. Deed"
                    value={d.label}
                    onChange={(e) => updateDoc(i, { label: e.target.value })}
                  />
                  <label
                    htmlFor={`doc-file-${i}`}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-2/60 px-3 py-2.5 text-xs text-muted-foreground transition hover:border-gold/50"
                  >
                    <FileText className="h-3.5 w-3.5 text-gold" />
                    <span className="max-w-[100px] truncate">{d.file ? d.file.name : "Choose file"}</span>
                  </label>
                  <input
                    id={`doc-file-${i}`}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFilePick(i, e.target)}
                  />
                  {docs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDocRow(i)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addDocRow}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:opacity-80 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add another document
            </button>
            {fieldErrors.documents && <FieldError msg={fieldErrors.documents[0]} />}
          </div>

          {error && <FieldError msg={error} />}

          <button
            disabled={submit.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save property
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

export function PropertyDetailModal({
  propertyId,
  onClose,
  adminMode = false,
}: {
  propertyId: number;
  onClose: () => void;
  adminMode?: boolean;
}) {
  const qc = useQueryClient();
  const docPreview = useReceiptPreview();
  const canApprove = useHasPermission("properties.approve");
  const [requestKind, setRequestKind] = useState<"sell" | "development" | null>(null);

  const query = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => (await api.get(`/properties/${propertyId}`)).data,
  });

  const p = query.data;

  const del = useMutation({
    mutationFn: async () => api.delete(`/properties/${propertyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-properties"] });
      qc.invalidateQueries({ queryKey: ["all-properties"] });
      toast.success("Property deleted");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const reviewRequest = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      await api.put(`/property-requests/${id}/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["all-properties"] });
      toast.success("Request updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const requests = p?.requests ?? [];
  const hasActiveSell = requests.some((r: any) => r.kind === "sell" && (r.status === "pending" || r.status === "approved"));
  const hasActiveDev = requests.some((r: any) => r.kind === "development" && (r.status === "pending" || r.status === "approved"));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar p-6">
        {query.isLoading || !p ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {p.location}
                </div>
                {adminMode && <div className="mt-1 text-xs text-muted-foreground">Owner: {p.owner_name}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={p.status} />
                <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</div>
                <div className="mt-0.5 font-medium">{TYPE_LABELS[p.type] ?? p.type}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated Value</div>
                <div className="mt-0.5 font-medium">{p.estimated_value != null ? fmtBDT(Number(p.estimated_value)) : "—"}</div>
              </div>
            </div>

            {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}

            {p.documents?.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Documents</div>
                <div className="flex flex-wrap gap-2">
                  {p.documents.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => docPreview.open(`/properties/${p.id}/documents/${d.id}`)}
                      title={d.file_name}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-gold/50 hover:text-gold cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" /> {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-border/60 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sell / Development Requests</div>
              {requests.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-surface-2/60 px-3 py-4 text-center text-xs text-muted-foreground">
                  No requests yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-border/60 bg-surface-2 px-3 py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">{r.kind === "sell" ? "Sell" : "Development for BAG"}</div>
                          {r.asking_price != null && (
                            <div className="text-xs text-muted-foreground">Asking price: {fmtBDT(Number(r.asking_price))}</div>
                          )}
                          {r.details && <div className="mt-1 text-xs text-muted-foreground">{r.details}</div>}
                          {r.status !== "pending" && r.reviewed_by && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {r.status === "approved" ? "Approved" : "Rejected"} by {r.reviewed_by}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      {adminMode && canApprove && r.status === "pending" && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => reviewRequest.mutate({ id: r.id, status: "approved" })}
                            className="flex-1 rounded-md border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 py-1.5 text-xs font-medium text-[color:var(--success)] hover:bg-[color:var(--success)]/20 cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reviewRequest.mutate({ id: r.id, status: "rejected" })}
                            className="flex-1 rounded-md border border-destructive/40 bg-destructive/10 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!adminMode && (
              <div className="mt-4 flex items-center gap-2">
                {!hasActiveSell && (
                  <button
                    onClick={() => setRequestKind("sell")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 py-2 text-xs font-medium text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                  >
                    <Tag className="h-3.5 w-3.5" /> Request Sell
                  </button>
                )}
                {!hasActiveDev && (
                  <button
                    onClick={() => setRequestKind("development")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 py-2 text-xs font-medium text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                  >
                    <HandCoins className="h-3.5 w-3.5" /> Development for BAG
                  </button>
                )}
              </div>
            )}

            {!adminMode && (
              <button
                onClick={() => {
                  if (confirm("Delete this property? This cannot be undone.")) del.mutate();
                }}
                disabled={del.isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/40 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete property
              </button>
            )}
          </>
        )}

        {docPreview.preview && (
          <ReceiptPreviewModal url={docPreview.preview.url} mime={docPreview.preview.mime} onClose={docPreview.close} />
        )}
      </div>

      {requestKind && p && (
        <PropertyRequestDialog
          propertyId={p.id}
          kind={requestKind}
          onClose={() => setRequestKind(null)}
          onDone={() => {
            setRequestKind(null);
            qc.invalidateQueries({ queryKey: ["property", propertyId] });
          }}
        />
      )}
    </div>
  );
}

function PropertyRequestDialog({
  propertyId,
  kind,
  onClose,
  onDone,
}: {
  propertyId: number;
  kind: "sell" | "development";
  onClose: () => void;
  onDone: () => void;
}) {
  const [askingPrice, setAskingPrice] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { kind, details: details.trim() || null };
      if (kind === "sell" && askingPrice) payload.asking_price = Number(askingPrice);
      await api.post(`/properties/${propertyId}/requests`, payload);
    },
    onSuccess: () => {
      toast.success("Request submitted — pending Super Admin approval");
      onDone();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-background/70 p-4 backdrop-blur" onClick={onClose}>
      <div className="noir-panel w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            {kind === "sell" ? "Request Sell" : "Request Development for BAG"}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 text-xs text-muted-foreground">
          This is a request only — approval (Super Admin) is required before this takes effect.
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            submit.mutate();
          }}
          className="space-y-3"
        >
          {kind === "sell" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Asking price (BDT, optional)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="pi"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kind === "sell" ? "Reason / notes (optional)" : "Details (optional)"}
            </span>
            <textarea className="pi min-h-[70px]" value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {error && <FieldError msg={error} />}
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
