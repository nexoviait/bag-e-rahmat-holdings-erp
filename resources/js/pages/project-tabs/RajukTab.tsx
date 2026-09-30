import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate, fmtFileSize } from "@/lib/format";
import { useHasPermission, useIsAdmin } from "@/lib/session";
import { Plus, Trash2, Download, X, Loader2, FileText, UploadCloud, AlertCircle, Landmark } from "lucide-react";
import { toast } from "sonner";
import { validateFile } from "@/lib/fileValidation";

// Mirrors ProjectDocumentController::ALLOWED_EXTENSIONS and its max:20480 rule
// (RAJUK docs are stored as regular project_documents rows — see the
// 2026_09_29_071542_add_rajuk_document_types migration).
const DOCUMENT_RULES = {
  extensions: ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "jpg", "jpeg", "png", "txt", "zip"],
  maxBytes: 20 * 1024 * 1024,
};

type RajukCategory = { type: string; label: string; hint: string };

const CATEGORIES: RajukCategory[] = [
  { type: "RAJUK Approval", label: "Approval", hint: "Approval letters and all related papers" },
  { type: "RAJUK Drawing", label: "RAJUK Drawing", hint: "Approved architectural/structural drawings" },
  { type: "RAJUK Photo", label: "Photos", hint: "Site and building photos" },
];

export function RajukTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canView = useHasPermission("documents.view");
  // RAJUK papers are official/regulatory records — unlike the general
  // Documents tab, upload and delete are admin-only here; everyone with
  // documents.view (user, nominee) can still see what's already there.
  const isAdmin = useIsAdmin();
  const canCreate = isAdmin;
  const canDelete = isAdmin;
  const [uploadFor, setUploadFor] = useState<RajukCategory | null>(null);

  const documents = useQuery({
    queryKey: ["project-documents", projectId],
    enabled: canView,
    queryFn: async () => (await api.get(`/projects/${projectId}/documents`)).data as any[],
  });

  const del = useMutation({
    mutationFn: async (doc: any) => {
      await api.delete(`/projects/${projectId}/documents/${doc.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("File deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  async function downloadDoc(doc: any) {
    try {
      const res = await api.get(`/projects/${projectId}/documents/${doc.id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name || doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download file");
    }
  }

  const all = documents.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-gold" />
        <div>
          <h2 className="font-display text-2xl font-semibold">RAJUK</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approval papers, RAJUK drawings and site photos for this project.
          </p>
        </div>
      </div>

      {!canView && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          Your role does not have permission to view documents.
        </div>
      )}

      {canView && (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const rows = all.filter((d) => d.document_type === cat.type);
            return (
              <div key={cat.type} className="noir-panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{cat.label}</h3>
                    <p className="text-xs text-muted-foreground">{cat.hint}</p>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => setUploadFor(cat)}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Upload
                    </button>
                  )}
                </div>

                {documents.isLoading ? (
                  <div className="grid h-20 place-items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gold" />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No files uploaded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {rows.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-gold" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{doc.name}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span>{fmtFileSize(doc.file_size)}</span>
                              <span>·</span>
                              <span>{fmtDate(doc.created_at)}</span>
                              {doc.uploaded_by && (
                                <>
                                  <span>·</span>
                                  <span>By {doc.uploaded_by}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => downloadDoc(doc)}
                            title="Download"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => confirm(`Delete "${doc.name}"?`) && del.mutate(doc)}
                              title="Delete"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploadFor && (
        <RajukUploadDialog projectId={projectId} category={uploadFor} onClose={() => setUploadFor(null)} />
      )}
    </div>
  );
}

function RajukUploadDialog({
  projectId,
  category,
  onClose,
}: {
  projectId: string;
  category: RajukCategory;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const maxSizeMb = 20;

  // A single file keeps its own custom name (defaults to the filename);
  // multiple files skip the name field entirely and each just uses its own
  // filename — asking for one name to cover several files doesn't make sense.
  const isMulti = files.length > 1;

  const upload = useMutation({
    mutationFn: async () => {
      for (const file of files) {
        const formData = new FormData();
        formData.append("name", isMulti ? file.name.replace(/\.[^.]+$/, "") : name.trim() || file.name.replace(/\.[^.]+$/, ""));
        formData.append("document_type", category.type);
        formData.append("visibility", "all");
        formData.append("file", file);

        // The shared `api` instance defaults to Content-Type: application/json, which makes
        // axios JSON-stringify FormData bodies (dropping the actual file). Overriding it here
        // lets the browser set the correct multipart/form-data boundary itself.
        await api.post(`/projects/${projectId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success(files.length > 1 ? `${files.length} files uploaded` : "File uploaded");
      onClose();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || e.message);
    },
  });

  function handleFiles(input: HTMLInputElement) {
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;

    const picked: File[] = [];
    for (const f of Array.from(fileList)) {
      const rejection = validateFile(f, DOCUMENT_RULES);
      if (rejection) {
        toast.error(`${f.name}: ${rejection}`);
      } else {
        picked.push(f);
      }
    }
    setFiles(picked);
    setError(null);
    if (picked.length === 0) input.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Upload — {category.label}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (files.length === 0) {
              setError("Please choose at least one file.");
              return;
            }
            setError(null);
            upload.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              File{isMulti ? "s" : ""}
            </span>
            <label
              htmlFor="rajuk-file-input"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2/60 px-4 py-4 text-sm text-muted-foreground transition hover:border-gold/50"
            >
              <UploadCloud className="h-5 w-5 shrink-0 text-gold" />
              <span className="min-w-0 truncate">
                {files.length === 0
                  ? "Click to choose file(s) — PDF, Word, Excel, image (max 20MB each)"
                  : files.length === 1
                  ? files[0].name
                  : `${files.length} files selected`}
              </span>
            </label>
            <input
              id="rajuk-file-input"
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.zip,.csv"
              onChange={(e) => handleFiles(e.target)}
            />
            {error && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </label>

          {!isMulti && files.length === 1 && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name (optional)
              </span>
              <input
                className="pi"
                placeholder={files[0].name}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          {isMulti && (
            <div className="text-xs text-muted-foreground">
              Each file will be uploaded separately, named after its own filename.
            </div>
          )}

          <button
            disabled={upload.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {upload.isPending ? "Uploading…" : `Upload ${files.length > 1 ? `${files.length} files` : "file"}`}
          </button>
        </form>
      </div>
    </div>
  );
}
