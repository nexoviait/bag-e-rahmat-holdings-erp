import React, { useState } from "react";
import { api } from "@/lib/api";
import { X, Download } from "lucide-react";
import { toast } from "sonner";

/**
 * Fetches a receipt through the shared `api` instance (Bearer-token auth
 * means a plain <a href> or window.open() would hit the route with no
 * Authorization header and just 401 — see lib/api.ts) and shows it in an
 * in-page overlay rather than a new browser tab. A new-tab/window.open()
 * approach was tried first and dropped: window.open() must fire synchronously
 * inside the click to count as user-initiated, and by the time the receipt
 * fetch resolves that window is one tick too late — real browsers silently
 * popup-block it. An in-page preview has no such timing dependency.
 */
export function useReceiptPreview() {
  const [preview, setPreview] = useState<{ url: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function open(fetchUrl: string) {
    setLoading(true);
    try {
      const res = await api.get(fetchUrl, { responseType: "blob" });
      setPreview({ url: URL.createObjectURL(res.data), mime: res.data.type || "application/octet-stream" });
    } catch {
      toast.error("Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  return { preview, loading, open, close };
}

export function ReceiptPreviewModal({
  url,
  mime,
  onClose,
}: {
  url: string;
  mime: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="absolute -top-3 -right-3 z-10 flex items-center gap-2">
          <a
            href={url}
            download="receipt"
            title="Download"
            className="rounded-full border border-border bg-surface-2 p-1.5 text-foreground shadow-md hover:border-gold/50"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            onClick={onClose}
            aria-label="Close receipt preview"
            className="rounded-full border border-border bg-surface-2 p-1.5 text-foreground shadow-md hover:border-gold/50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {mime.startsWith("image/") ? (
          <img src={url} alt="Receipt" className="mx-auto max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" />
        ) : (
          // #toolbar=0&navpanes=0&scrollbar=0 tells Chromium's built-in PDF
          // viewer to drop its own toolbar and thumbnail sidebar — without it,
          // the browser fills the iframe with its full PDF.js chrome (page
          // list, zoom, print/download icons), which is a lot of clutter for
          // "quickly check a receipt". Our own download/close buttons above
          // cover what that chrome provided.
          <iframe
            title="Receipt"
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="h-[85vh] w-full rounded-lg border border-border bg-white shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
