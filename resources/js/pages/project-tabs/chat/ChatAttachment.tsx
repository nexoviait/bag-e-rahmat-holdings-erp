import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtFileSize } from "@/lib/format";
import { Download, FileText, Loader2 } from "lucide-react";
import { ReceiptPreviewModal } from "@/components/ReceiptViewer";
import { ChatMessage } from "./types";

/**
 * Fetches the attachment through the shared `api` instance (Bearer-token
 * auth — a plain <img src> / <a href> would hit the endpoint with no
 * Authorization header and just 401) and hands back an object URL, exactly
 * ReceiptViewer.tsx's justified reasoning for the same problem.
 */
function useAuthenticatedBlob(url: string) {
  const [state, setState] = useState<{ url: string; mime: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    api
      .get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setState({ url: objectUrl, mime: res.data.type || "application/octet-stream" });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { ...state, failed };
}

export function ChatAttachment({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const url = `/chat/messages/${message.id}/attachment`;
  const { url: blobUrl, mime, failed } = useAuthenticatedBlob(url);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (failed) {
    return <div className="px-1 text-xs text-destructive">Failed to load attachment.</div>;
  }

  if (!blobUrl) {
    return (
      <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-surface-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (message.type === "image") {
    return (
      <>
        <img
          src={blobUrl}
          alt={message.attachment_name ?? "Image"}
          onClick={() => setPreviewOpen(true)}
          className="max-h-64 max-w-full cursor-pointer rounded-lg object-cover"
        />
        {previewOpen && (
          <ReceiptPreviewModal url={blobUrl} mime={mime ?? "image/jpeg"} onClose={() => setPreviewOpen(false)} />
        )}
      </>
    );
  }

  if (message.type === "video") {
    return (
      <video controls src={blobUrl} className="max-h-64 max-w-full rounded-lg bg-black">
        Your browser does not support video playback.
      </video>
    );
  }

  if (message.type === "voice_note") {
    // w-full on the audio element itself (not a fixed min-width on the
    // wrapper) — on the narrowest phones, the message bubble's own
    // max-w-[75%] can be less than 220px once its padding is subtracted,
    // and a hard min-width would overflow the bubble rather than shrink to fit.
    return (
      <div className="flex w-[min(220px,100%)] items-center gap-2">
        <audio controls src={blobUrl} className="h-9 w-full" />
      </div>
    );
  }

  // 'file' — a plain download chip, styled distinctly whether it's my own
  // sent bubble (gold) or a received one (surface).
  return (
    <a
      href={blobUrl}
      download={message.attachment_name ?? "file"}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition hover:opacity-90 ${
        isMine ? "bg-background/10" : "bg-background/40"
      }`}
    >
      <FileText className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{message.attachment_name ?? "File"}</div>
        <div className="text-[10px] opacity-70">{fmtFileSize(message.attachment_size)}</div>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
