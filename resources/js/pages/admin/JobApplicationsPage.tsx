import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin, useHasPermission } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Award, Star, Check, X as XIcon, Loader2 } from "lucide-react";
import { useReceiptPreview, ReceiptPreviewModal } from "@/components/ReceiptViewer";

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

export function JobApplicationsPage() {
  const isAdmin = useIsAdmin();
  const canReview = useHasPermission("job_applications.review");
  const qc = useQueryClient();
  const docPreview = useReceiptPreview();

  const applications = useQuery({
    queryKey: ["all-job-applications"],
    enabled: isAdmin,
    queryFn: async () => (await api.get("/job-applications")).data as any[],
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "shortlisted" | "approved" | "rejected" | "pending" }) => {
      await api.put(`/job-applications/${id}/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-job-applications"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const list = applications.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Job Applications"
        description="Applications submitted company-wide from the Job Application page — not tied to any project."
      />
      <AdminNavTabs />

      {applications.isLoading ? (
        <div className="noir-panel grid h-24 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : list.length === 0 ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">No job applications yet.</div>
      ) : (
        <div className="noir-panel overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.applicant_name}</div>
                      <div className="text-xs text-muted-foreground">{a.applicant_email}</div>
                    </td>
                    <td className="px-4 py-3">{a.position}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => docPreview.open(`/job-applications/${a.id}/cv`)}
                          title={a.cv_name}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => docPreview.open(`/job-applications/${a.id}/photo`)}
                          title={a.photo_name}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                        {a.certificate_name && (
                          <button
                            onClick={() => docPreview.open(`/job-applications/${a.id}/certificate`)}
                            title={a.certificate_name}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                          >
                            <Award className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canReview && (
                        <div className="flex items-center justify-end gap-1">
                          {a.status !== "shortlisted" && a.status !== "approved" && (
                            <button
                              onClick={() => setStatus.mutate({ id: a.id, status: "shortlisted" })}
                              title="Shortlist"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-blue-500/15 hover:text-blue-500 cursor-pointer"
                            >
                              <Star className="h-4 w-4" />
                            </button>
                          )}
                          {a.status !== "approved" && (
                            <button
                              onClick={() => setStatus.mutate({ id: a.id, status: "approved" })}
                              title="Approve"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-[color:var(--success)]/15 hover:text-[color:var(--success)] cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {a.status !== "rejected" && (
                            <button
                              onClick={() => setStatus.mutate({ id: a.id, status: "rejected" })}
                              title="Reject"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {docPreview.preview && (
        <ReceiptPreviewModal url={docPreview.preview.url} mime={docPreview.preview.mime} onClose={docPreview.close} />
      )}
    </>
  );
}
