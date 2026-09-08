import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate, fmtFileSize } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import {
  Plus,
  Trash2,
  Download,
  Edit2,
  X,
  Loader2,
  FileText,
  UploadCloud,
  AlertCircle,
  Check,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

export function DocumentsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canView = useHasPermission("documents.view");
  const canCreate = useHasPermission("documents.create");
  const canEditDocs = useHasPermission("documents.edit");
  const canDelete = useHasPermission("documents.delete");
  const [open, setOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);

  const documents = useQuery({
    queryKey: ["project-documents", projectId],
    enabled: canView,
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/documents`);
      return res.data as any[];
    },
  });

  const del = useMutation({
    mutationFn: async (doc: any) => {
      await api.delete(`/projects/${projectId}/documents/${doc.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  async function downloadDoc(doc: any) {
    try {
      const res = await api.get(`/projects/${projectId}/documents/${doc.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name || doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Failed to download document");
    }
  }

  const list = documents.data ?? [];

  function visibilityLabel(doc: any) {
    if (doc.visibility === "all") return "Everyone";
    if (doc.visibility === "specific") {
      const names: string[] = (doc.assignees ?? []).map((a: any) => a.name);
      if (names.length === 0) return "Admin only";
      if (names.length <= 2) return names.join(", ");
      return `${names[0]} +${names.length - 1} more`;
    }
    return "Admin only";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, deeds, statements and other files attached to this project ·{" "}
            {list.length} {list.length === 1 ? "file" : "files"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingDoc(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Upload document
          </button>
        )}
      </div>

      {!canView && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          Your role does not have permission to view documents.
        </div>
      )}

      {canView && documents.isLoading && (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">Loading…</div>
      )}

      {canView && !documents.isLoading && list.length === 0 && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No documents uploaded yet.
        </div>
      )}

      {/* Mobile / tablet: card list */}
      {canView && list.length > 0 && (
        <div className="grid gap-3 lg:hidden">
          {list.map((doc) => (
            <div key={doc.id} className="noir-panel min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{doc.name}</div>
                    {doc.document_type && (
                      <div className="mt-0.5 text-xs text-gold">{doc.document_type}</div>
                    )}
                  </div>
                </div>
              </div>
              {doc.description && (
                <div className="mt-2 text-sm text-muted-foreground">{doc.description}</div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{doc.file_name}</span>
                <span>{fmtFileSize(doc.file_size)}</span>
                <span>{fmtDate(doc.created_at)}</span>
                {doc.uploaded_by && <span>By {doc.uploaded_by}</span>}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                <UserRound className="h-3 w-3 shrink-0 text-gold" />
                <span className={doc.visibility === "admin_only" ? "text-muted-foreground" : "text-foreground"}>
                  {visibilityLabel(doc)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/40 pt-3">
                <button
                  onClick={() => downloadDoc(doc)}
                  title="Download"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>
                {canEditDocs && (
                  <button
                    onClick={() => {
                      setEditingDoc(doc);
                      setOpen(true);
                    }}
                    title="Edit"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
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

      {/* Desktop: table */}
      {canView && list.length > 0 && (
        <div className="noir-panel hidden overflow-hidden lg:block">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-gold" />
                        {doc.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.document_type ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      <div className="line-clamp-2">{doc.description ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.file_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtFileSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(doc.created_at)}
                      {doc.uploaded_by && (
                        <div className="text-xs text-muted-foreground/70">by {doc.uploaded_by}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={doc.visibility === "admin_only" ? "text-muted-foreground" : "text-foreground"}>
                        {visibilityLabel(doc)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => downloadDoc(doc)}
                          title="Download"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canEditDocs && (
                          <button
                            onClick={() => {
                              setEditingDoc(doc);
                              setOpen(true);
                            }}
                            title="Edit"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <UploadDialog
          projectId={projectId}
          initialData={editingDoc}
          onClose={() => {
            setOpen(false);
            setEditingDoc(null);
          }}
        />
      )}
    </div>
  );
}

type FieldErrors = Record<string, string[]>;

function UploadDialog({
  projectId,
  initialData,
  onClose,
}: {
  projectId: string;
  initialData?: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [documentType, setDocumentType] = useState(initialData?.document_type ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [visibility, setVisibility] = useState<"admin_only" | "specific" | "all">(
    initialData?.visibility ?? "admin_only"
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    (initialData?.assignees ?? []).map((a: any) => String(a.id))
  );
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);

  const maxSizeMb = 20;

  const types = useQuery({
    queryKey: ["document-types"],
    queryFn: async () => {
      const res = await api.get("/document-types");
      return res.data as { id: number; name: string }[];
    },
  });

  const members = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/documents/assignable-users`);
      return res.data as { id: number; name: string; email: string }[];
    },
  });

  const addType = useMutation({
    mutationFn: async () => {
      const res = await api.post("/document-types", { name: newTypeName.trim() });
      return res.data as { id: number; name: string };
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["document-types"] });
      setDocumentType(created.name);
      setNewTypeName("");
      setAddingType(false);
      setTypeError(null);
      toast.success("Document type added");
    },
    onError: (e: any) => {
      const msg = e.response?.data?.errors?.name?.[0] || e.response?.data?.message || e.message;
      setTypeError(msg);
    },
  });

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = ["Document name is required."];
    if (!documentType) errors.document_type = ["Please select a document type."];
    if (visibility === "specific" && selectedAssignees.length === 0) {
      errors.assignees = ["Select at least one user, or choose a different visibility option."];
    }
    if (!isEditing) {
      if (!file) {
        errors.file = ["Please choose a file to upload."];
      } else if (file.size > maxSizeMb * 1024 * 1024) {
        errors.file = [`File is too large. Maximum size is ${maxSizeMb}MB.`];
      }
    }
    return errors;
  }

  function toggleAssignee(id: string) {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (fieldErrors.assignees) setFieldErrors((p) => ({ ...p, assignees: undefined }));
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        const payload: Record<string, any> = {
          name,
          document_type: documentType,
          description: description || null,
          visibility,
        };
        if (visibility === "specific") payload.assignees = selectedAssignees;

        await api.put(`/projects/${projectId}/documents/${initialData.id}`, payload);
        return;
      }

      if (!file) return; // guarded by validate() before mutate() is ever called

      const formData = new FormData();
      formData.append("name", name);
      formData.append("document_type", documentType);
      if (description) formData.append("description", description);
      formData.append("visibility", visibility);
      if (visibility === "specific") {
        selectedAssignees.forEach((id) => formData.append("assignees[]", id));
      }
      formData.append("file", file);

      // The shared `api` instance defaults to Content-Type: application/json, which makes
      // axios JSON-stringify FormData bodies (dropping the actual file). Overriding it here
      // lets the browser set the correct multipart/form-data boundary itself.
      await api.post(`/projects/${projectId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success(isEditing ? "Document updated" : "Document uploaded");
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as FieldErrors | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">
            {isEditing ? "Edit document" : "Upload document"}
          </h3>
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
            upload.mutate();
          }}
          className="space-y-4"
        >
          <Fld label="Document name" error={fieldErrors.name?.[0]}>
            <input
              className="pi"
              placeholder="e.g. Land Purchase Deed"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
              }}
            />
          </Fld>

          <Fld label="Document type" error={fieldErrors.document_type?.[0]}>
            <div className="flex items-center gap-2">
              <select
                className="pi"
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  if (fieldErrors.document_type) {
                    setFieldErrors((p) => ({ ...p, document_type: undefined }));
                  }
                }}
                disabled={types.isLoading}
              >
                <option value="">
                  {types.isLoading ? "Loading types…" : "-- Select type --"}
                </option>
                {(types.data ?? []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setAddingType((v) => !v);
                  setTypeError(null);
                }}
                title="Add new document type"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface-2 px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {addingType && (
              <div className="mt-2 rounded-lg border border-border bg-surface-2/60 p-3">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="pi"
                    placeholder="e.g. Site Photo"
                    value={newTypeName}
                    onChange={(e) => {
                      setNewTypeName(e.target.value);
                      if (typeError) setTypeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newTypeName.trim()) addType.mutate();
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Confirm add type"
                    disabled={!newTypeName.trim() || addType.isPending}
                    onClick={() => addType.mutate()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60 cursor-pointer"
                  >
                    {addType.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Cancel add type"
                    onClick={() => {
                      setAddingType(false);
                      setNewTypeName("");
                      setTypeError(null);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {typeError && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{typeError}</span>
                  </div>
                )}
              </div>
            )}
          </Fld>

          <Fld label="Description (optional)" error={fieldErrors.description?.[0]}>
            <textarea
              className="pi min-h-[70px]"
              placeholder="Brief note about this document"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Fld>

          <Fld label="Who can see this document?">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setVisibility("admin_only")}
                className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                  visibility === "admin_only"
                    ? "bg-gold text-slate-950 font-bold"
                    : "bg-surface-1 text-muted-foreground"
                }`}
              >
                Admin only
              </button>
              <button
                type="button"
                onClick={() => setVisibility("specific")}
                className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                  visibility === "specific"
                    ? "bg-gold text-slate-950 font-bold"
                    : "bg-surface-1 text-muted-foreground"
                }`}
              >
                Specific users
              </button>
              <button
                type="button"
                onClick={() => setVisibility("all")}
                className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                  visibility === "all"
                    ? "bg-gold text-slate-950 font-bold"
                    : "bg-surface-1 text-muted-foreground"
                }`}
              >
                All (everyone)
              </button>
            </div>

            {visibility === "specific" && (
              <div className="no-scrollbar mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2/60 p-2">
                {members.isLoading && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Loading members…</div>
                )}
                {!members.isLoading && (members.data ?? []).length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    No other project members to assign.
                  </div>
                )}
                {(members.data ?? []).map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-gold"
                      checked={selectedAssignees.includes(String(m.id))}
                      onChange={() => toggleAssignee(String(m.id))}
                    />
                    <span className="truncate text-foreground">{m.name}</span>
                  </label>
                ))}
              </div>
            )}

            {fieldErrors.assignees?.[0] ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{fieldErrors.assignees[0]}</span>
              </div>
            ) : (
              <div className="mt-1.5 text-xs text-muted-foreground">
                {visibility === "all"
                  ? "Every project member will be able to see this document."
                  : visibility === "specific"
                  ? "Only admins and the selected user(s) will be able to see this document."
                  : "Only admins will be able to see this document."}
              </div>
            )}
          </Fld>

          {isEditing ? (
            <Fld label="File">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-4 py-3 text-sm text-muted-foreground">
                <FileText className="h-5 w-5 shrink-0 text-gold" />
                <span className="min-w-0 truncate">{initialData.file_name}</span>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                To replace the file itself, delete this document and upload a new one.
              </div>
            </Fld>
          ) : (
            <Fld label="File" error={fieldErrors.file?.[0]}>
              <label
                htmlFor="doc-file-input"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2/60 px-4 py-4 text-sm text-muted-foreground transition hover:border-gold/50"
              >
                <UploadCloud className="h-5 w-5 shrink-0 text-gold" />
                <span className="min-w-0 truncate">
                  {file ? file.name : "Click to choose a file (PDF, Word, Excel, image — max 20MB)"}
                </span>
              </label>
              <input
                id="doc-file-input"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.zip,.csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  if (fieldErrors.file) setFieldErrors((p) => ({ ...p, file: undefined }));
                }}
              />
              {file && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              )}
            </Fld>
          )}

          <button
            disabled={upload.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Update document" : "Upload document"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Fld({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
