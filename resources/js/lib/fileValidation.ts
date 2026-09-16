import { toast } from "sonner";

/**
 * Client-side mirror of this app's server-side upload rules (extension
 * allowlist + `max:` size, checked the same way on every controller —
 * FinancialController::handleReceiptUpload(), ProjectDocumentController,
 * MaterialController, MaterialTransactionController, ChatAttachmentRules).
 *
 * This exists so a bad file is rejected the instant it's picked, with a
 * plain-language message, instead of only failing after a full upload
 * round-trip — either as a cryptic axios error (a 413 from nginx/PHP's own
 * post size limit, hit before Laravel ever sees the request) or a generic
 * 422 from the backend's own — otherwise identical — check.
 *
 * Never a substitute for the server-side check (which stays authoritative
 * and un-bypassable) — purely a faster, friendlier first line of defense.
 */
export type FileValidationOptions = {
  /** Lowercase extensions without the dot, e.g. ["jpg", "png", "pdf"]. Omit to allow any extension (size-only check). */
  extensions?: string[];
  /** Matches the backend's `max:` validation rule, in bytes. */
  maxBytes: number;
};

export function validateFile(file: File, opts: FileValidationOptions): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (opts.extensions && !opts.extensions.includes(ext)) {
    return `Unsupported file type. Allowed: ${opts.extensions.join(", ").toUpperCase()}.`;
  }
  if (file.size > opts.maxBytes) {
    const maxMb = opts.maxBytes / (1024 * 1024);
    const gotMb = (file.size / (1024 * 1024)).toFixed(1);
    return `File is too large — max ${maxMb % 1 === 0 ? maxMb : maxMb.toFixed(1)}MB, this one is ${gotMb}MB.`;
  }
  return null;
}

/**
 * Convenience for a plain `<input type="file">` onChange handler: validates
 * the first selected file and, on failure, shows a toast and resets the
 * input's value — so the picker never silently keeps displaying a filename
 * that will never actually be uploaded. Returns the valid File, or null
 * (nothing selected, or rejected).
 */
export function pickValidatedFile(input: HTMLInputElement, opts: FileValidationOptions): File | null {
  const file = input.files?.[0];
  if (!file) return null;

  const error = validateFile(file, opts);
  if (error) {
    toast.error(error);
    input.value = "";
    return null;
  }
  return file;
}
