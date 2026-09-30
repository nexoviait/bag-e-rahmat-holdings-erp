import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate, fmtBDT } from "@/lib/format";
import { useHasPermission, useSession } from "@/lib/session";
import { X, Plus, Loader2, FileText, Image as ImageIcon, AlertCircle, UploadCloud, UserRound, Edit2, Trash2, ChevronDown, ChevronUp, Phone } from "lucide-react";
import { toast } from "sonner";
import { validateFile } from "@/lib/fileValidation";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";

const DOC_RULES = { extensions: ["pdf", "jpg", "jpeg", "png"], maxBytes: 20 * 1024 * 1024 };

/**
 * Any logged-in user can nominate a representative for a shareholder here —
 * the nominee immediately gets a login account, but it stays inactive until
 * Super Admin approves it from the admin Nominees page (NomineesPage.tsx).
 */
export function NomineesModal({
  shareholder,
  onClose,
}: {
  shareholder: { id: number | string; name: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const canCreate = useHasPermission("nominees.create");
  const canManageAny = useHasPermission("nominees.edit");
  const [showAdd, setShowAdd] = useState(false);
  const [editingNominee, setEditingNominee] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const docPreview = useReceiptPreview();

  const nominees = useQuery({
    queryKey: ["nominees", shareholder.id],
    queryFn: async () => (await api.get(`/nominees?shareholder_id=${shareholder.id}`)).data as any[],
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/nominees/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nominees", shareholder.id] });
      toast.success("Nominee deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const list = nominees.data ?? [];
  const allocatedPct = list.reduce((s: number, n: any) => s + Number(n.ownership_percentage ?? 0), 0);
  const availablePct = Math.max(0, Math.round((100 - allocatedPct) * 100) / 100);
  const canManage = (n: any) => canManageAny || String(n.created_by_id) === String(user?.id);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold">Nominees</h3>
            <p className="text-xs text-muted-foreground">For {shareholder.name}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {nominees.isLoading ? (
          <div className="grid h-20 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-surface-2/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No nominees added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n: any) => (
              <div key={n.id} className="rounded-lg border border-border/60 bg-surface-2 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-gold" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{n.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.email}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        n.status === "approved"
                          ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                          : "bg-gold/15 text-gold"
                      }`}
                    >
                      {n.status}
                    </span>
                    {canManage(n) && (
                      <>
                        <button
                          onClick={() => setEditingNominee(n)}
                          title="Edit nominee"
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => confirm(`Delete nominee "${n.name}"? This also removes their login.`) && del.mutate(n.id)}
                          title="Delete nominee"
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      title="View details"
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                    >
                      {expandedId === n.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{n.ownership_percentage}% ownership</span>
                  <span>·</span>
                  <span className="font-medium text-gold">{fmtBDT(n.share_price)}</span>
                  <span>·</span>
                  <span>Submitted {fmtDate(n.created_at)}</span>
                </div>

                {expandedId === n.id && (
                  <div className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5 text-xs">
                    <div className="text-muted-foreground">
                      Share price: <span className="font-medium text-gold">{fmtBDT(n.share_price)}</span>{" "}
                      ({n.ownership_percentage}% of {shareholder.name}'s {fmtBDT(n.shareholder_share_price)})
                    </div>
                    {n.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gold" />
                        <span>{n.phone}</span>
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      Submitted by <span className="text-foreground">{n.created_by ?? "—"}</span>
                    </div>
                    {n.status === "approved" && (
                      <div className="text-muted-foreground">
                        Approved by <span className="text-foreground">{n.approved_by ?? "—"}</span>
                        {n.approved_at && <> on {fmtDate(n.approved_at)}</>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => docPreview.open(`/nominees/${n.id}/nid`)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" /> {n.nid_name || "ID document"}
                      </button>
                      <button
                        onClick={() => docPreview.open(`/nominees/${n.id}/photo`)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                      >
                        <ImageIcon className="h-3.5 w-3.5" /> {n.photo_name || "Photo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {canCreate && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 py-2 text-sm font-medium text-gold transition hover:bg-gold hover:text-slate-950 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add nominee
          </button>
        )}

        {showAdd && (
          <AddNomineeForm
            shareholderId={shareholder.id}
            availablePct={availablePct}
            onDone={() => setShowAdd(false)}
            onCancel={() => setShowAdd(false)}
          />
        )}
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>

      {editingNominee && (
        <EditNomineeForm
          nominee={editingNominee}
          shareholderId={shareholder.id}
          onDone={() => setEditingNominee(null)}
          onCancel={() => setEditingNominee(null)}
        />
      )}

      {docPreview.preview && (
        <ReceiptPreviewModal url={docPreview.preview.url} mime={docPreview.preview.mime} onClose={docPreview.close} />
      )}
    </div>
  );
}

function EditNomineeForm({
  nominee,
  shareholderId,
  onDone,
  onCancel,
}: {
  nominee: any;
  shareholderId: number | string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(nominee.name ?? "");
  const [email, setEmail] = useState(nominee.email ?? "");
  const [phone, setPhone] = useState(nominee.phone ?? "");
  const [ownershipPercentage, setOwnershipPercentage] = useState(String(nominee.ownership_percentage ?? ""));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function validate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!name.trim()) errors.name = ["Name is required."];
    if (!email.trim()) errors.email = ["Email is required."];
    const pct = Number(ownershipPercentage);
    if (!ownershipPercentage || isNaN(pct) || pct <= 0 || pct > 100) {
      errors.ownership_percentage = ["Enter a valid percentage between 0 and 100."];
    }
    return errors;
  }

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/nominees/${nominee.id}`, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        ownership_percentage: Number(ownershipPercentage),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nominees", shareholderId] });
      toast.success("Nominee updated");
      onDone();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors) setFieldErrors(errors);
      setError(e.response?.data?.message || e.message);
    },
  });

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Edit nominee</h3>
          <button onClick={onCancel} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors = validate();
            if (Object.keys(errors).length > 0) {
              setFieldErrors(errors);
              return;
            }
            setFieldErrors({});
            setError(null);
            save.mutate();
          }}
          className="space-y-4"
        >
          <Fld label="Nominee name" error={fieldErrors.name?.[0]}>
            <input className="pi" value={name} onChange={(e) => setName(e.target.value)} />
          </Fld>
          <Fld label="Login email" error={fieldErrors.email?.[0]}>
            <input type="email" className="pi" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Fld>
          <Fld label="Phone (optional)">
            <input className="pi" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Fld>
          <Fld label="Ownership %" error={fieldErrors.ownership_percentage?.[0]}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              className="pi"
              value={ownershipPercentage}
              onChange={(e) => setOwnershipPercentage(e.target.value)}
            />
          </Fld>
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

function AddNomineeForm({
  shareholderId,
  availablePct,
  onDone,
  onCancel,
}: {
  shareholderId: number | string;
  availablePct: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [ownershipPercentage, setOwnershipPercentage] = useState("");
  const [nid, setNid] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function pick(input: HTMLInputElement, setter: (f: File | null) => void) {
    const file = input.files?.[0];
    if (!file) return;
    const rejection = validateFile(file, DOC_RULES);
    if (rejection) {
      toast.error(rejection);
      input.value = "";
      return;
    }
    setter(file);
  }

  function validate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!name.trim()) errors.name = ["Name is required."];
    if (!email.trim()) errors.email = ["Email is required."];
    if (!password || password.length < 6) errors.password = ["Password must be at least 6 characters."];
    const pct = Number(ownershipPercentage);
    if (!ownershipPercentage || isNaN(pct) || pct <= 0 || pct > 100) {
      errors.ownership_percentage = ["Enter a valid percentage between 0 and 100."];
    } else if (pct > availablePct + 0.01) {
      errors.ownership_percentage = [`Only ${availablePct}% of this shareholder's equity is left to nominate.`];
    }
    if (!nid) errors.nid = ["Please upload an NID/Birth Certificate/Passport file."];
    if (!photo) errors.photo = ["Please upload a photo."];
    return errors;
  }

  const submit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("shareholder_id", String(shareholderId));
      formData.append("name", name.trim());
      formData.append("email", email.trim());
      formData.append("password", password);
      if (phone.trim()) formData.append("phone", phone.trim());
      formData.append("ownership_percentage", ownershipPercentage);
      formData.append("nid", nid as File);
      formData.append("photo", photo as File);

      // The shared `api` instance defaults to Content-Type: application/json, which makes
      // axios JSON-stringify FormData bodies (dropping the actual files). Overriding it here
      // lets the browser set the correct multipart/form-data boundary itself.
      await api.post("/nominees", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nominees", shareholderId] });
      toast.success("Nominee submitted — pending Super Admin approval");
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
        This creates the nominee's own login. It stays inactive until a Super Admin approves it.
      </div>

      <Fld label="Nominee name" error={fieldErrors.name?.[0]}>
        <input className="pi" value={name} onChange={(e) => setName(e.target.value)} />
      </Fld>
      <div className="grid grid-cols-2 gap-3">
        <Fld label="Login email" error={fieldErrors.email?.[0]}>
          <input type="email" className="pi" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Fld>
        <Fld label="Login password" error={fieldErrors.password?.[0]}>
          <input type="password" className="pi" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Fld>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Fld label="Phone (optional)">
          <input className="pi" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Fld>
        <Fld label="Ownership %" error={fieldErrors.ownership_percentage?.[0]}>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={availablePct}
            placeholder={`up to ${availablePct}%`}
            className="pi"
            value={ownershipPercentage}
            onChange={(e) => setOwnershipPercentage(e.target.value)}
          />
          {!fieldErrors.ownership_percentage && (
            <div className="mt-1.5 text-xs text-muted-foreground">
              {availablePct}% of this shareholder's equity is still available to nominate.
            </div>
          )}
        </Fld>
      </div>

      <Fld label="NID / Birth Certificate / Passport" error={fieldErrors.nid?.[0]}>
        <FilePicker icon={FileText} file={nid} onPick={(input) => pick(input, setNid)} placeholder="Choose ID document" />
      </Fld>
      <Fld label="Photo" error={fieldErrors.photo?.[0]}>
        <FilePicker icon={ImageIcon} file={photo} onPick={(input) => pick(input, setPhoto)} placeholder="Choose photo" />
      </Fld>

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
          Submit nominee
        </button>
      </div>
    </form>
  );
}

function FilePicker({
  icon: Icon,
  file,
  onPick,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  file: File | null;
  onPick: (input: HTMLInputElement) => void;
  placeholder: string;
}) {
  const id = React.useId();
  return (
    <>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-gold/50"
      >
        <UploadCloud className="h-4 w-4 shrink-0 text-gold" />
        <span className="min-w-0 truncate">{file ? file.name : placeholder}</span>
      </label>
      <input
        id={id}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onPick(e.target)}
      />
    </>
  );
}

function Fld({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}
