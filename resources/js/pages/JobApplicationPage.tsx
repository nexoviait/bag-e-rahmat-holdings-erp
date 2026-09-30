import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import { Briefcase, Plus, X, Loader2, FileText, Image as ImageIcon, Award, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { validateFile } from "@/lib/fileValidation";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";

const DOC_RULES = { extensions: ["pdf", "jpg", "jpeg", "png"], maxBytes: 20 * 1024 * 1024 };

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : status === "shortlisted"
      ? "bg-blue-500/15 text-blue-500"
      : status === "rejected"
      ? "bg-destructive/15 text-destructive"
      : "bg-gold/15 text-gold";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{status}</span>;
}

export function JobApplicationPage() {
  const canCreate = useHasPermission("job_applications.create");
  const [showForm, setShowForm] = useState(false);
  const docPreview = useReceiptPreview();

  const applications = useQuery({
    queryKey: ["my-job-applications"],
    queryFn: async () => (await api.get("/job-applications")).data as any[],
  });

  const list = applications.data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-gold" />
            <h1 className="font-display text-2xl font-semibold">Job Application</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Apply for an open position — CV, photo and certificate required.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Apply for a job
          </button>
        )}
      </div>

      {applications.isLoading ? (
        <div className="noir-panel grid h-24 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : list.length === 0 ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">You haven't applied for anything yet.</div>
      ) : (
        <div className="space-y-2">
          {list.map((a: any) => (
            <div key={a.id} className="noir-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{a.position}</div>
                  <div className="text-xs text-muted-foreground">Applied {fmtDate(a.created_at)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {a.cover_note && <div className="mt-2 text-sm text-muted-foreground">{a.cover_note}</div>}
              {a.admin_notes && (
                <div className="mt-2 rounded-md border border-border/60 bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note from reviewer:</span> {a.admin_notes}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => docPreview.open(`/job-applications/${a.id}/cv`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" /> {a.cv_name}
                </button>
                <button
                  onClick={() => docPreview.open(`/job-applications/${a.id}/photo`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> {a.photo_name}
                </button>
                {a.certificate_name && (
                  <button
                    onClick={() => docPreview.open(`/job-applications/${a.id}/certificate`)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
                  >
                    <Award className="h-3.5 w-3.5" /> {a.certificate_name}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ApplyDialog onClose={() => setShowForm(false)} />}
      {docPreview.preview && (
        <ReceiptPreviewModal url={docPreview.preview.url} mime={docPreview.preview.mime} onClose={docPreview.close} />
      )}
    </div>
  );
}

function ApplyDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [position, setPosition] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
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
    if (!position.trim()) errors.position = ["Position is required."];
    if (!cv) errors.cv = ["Please upload your CV."];
    if (!photo) errors.photo = ["Please upload a photo."];
    return errors;
  }

  const submit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("position", position.trim());
      if (coverNote.trim()) formData.append("cover_note", coverNote.trim());
      formData.append("cv", cv as File);
      formData.append("photo", photo as File);
      if (certificate) formData.append("certificate", certificate);

      await api.post("/job-applications", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-job-applications"] });
      toast.success("Application submitted");
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Apply for a job</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
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
            submit.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Position / Job title</span>
            <input className="pi" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Site Engineer" />
            {fieldErrors.position && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{fieldErrors.position[0]}</span>
              </div>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Cover note (optional)</span>
            <textarea className="pi min-h-[70px]" value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
          </label>

          <FileFld label="CV" error={fieldErrors.cv?.[0]} icon={FileText} file={cv} onPick={(input) => pick(input, setCv)} placeholder="Choose CV (PDF)" />
          <FileFld label="Photo" error={fieldErrors.photo?.[0]} icon={ImageIcon} file={photo} onPick={(input) => pick(input, setPhoto)} placeholder="Choose photo" />
          <FileFld label="Certificate (optional)" icon={Award} file={certificate} onPick={(input) => pick(input, setCertificate)} placeholder="Choose certificate" />

          <button
            disabled={submit.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit application
          </button>
        </form>
        <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
      </div>
    </div>
  );
}

function FileFld({
  label,
  error,
  icon: Icon,
  file,
  onPick,
  placeholder,
}: {
  label: string;
  error?: string;
  icon: React.ComponentType<{ className?: string }>;
  file: File | null;
  onPick: (input: HTMLInputElement) => void;
  placeholder: string;
}) {
  const id = React.useId();
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-gold/50"
      >
        <Icon className="h-4 w-4 shrink-0 text-gold" />
        <span className="min-w-0 truncate">{file ? file.name : placeholder}</span>
      </label>
      <input id={id} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onPick(e.target)} />
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}
