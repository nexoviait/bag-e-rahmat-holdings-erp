import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Mic, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { fmtFileSize } from "@/lib/format";

// Matches ChatAttachmentRules server-side — these are only UX affordances
// (narrow the file picker, fail fast with a friendly message instead of
// uploading 50MB just to have the server reject it); the real enforcement
// is always server-side.
const ATTACHMENT_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv";
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

const MIC_MIME_CANDIDATES = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIC_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

type PendingAttachment = {
  file: File;
  previewUrl: string | null; // object URL, image/video only
  kind: "image" | "video" | "file";
};

export function MessageComposer({
  draft,
  onDraftChange,
  onSendText,
  onSendFile,
  sending,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSendText: () => void;
  onSendFile: (file: File, opts?: { type?: "voice_note"; durationMs?: number; caption?: string }) => void;
  sending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Picking a file stages it here for review — matching every real chat
  // app's flow (thumbnail/filename + optional caption, THEN an explicit
  // Send) instead of uploading the instant it's picked, which gave no
  // chance to double-check or back out of the wrong file.
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    };
  }, [pending]);

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file twice in a row
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File is too large — the limit is 50MB.");
      return;
    }

    const kind: PendingAttachment["kind"] = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
      ? "video"
      : "file";
    const previewUrl = kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
    setPending({ file, previewUrl, kind });
  }

  function cancelPending() {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setCaption("");
  }

  function confirmSend() {
    if (!pending) return;
    onSendFile(pending.file, { caption: caption.trim() || undefined });
    if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setCaption("");
  }

  async function startRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - recordingStartRef.current;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (durationMs >= 500) {
          if (blob.size > MAX_ATTACHMENT_BYTES) {
            toast.error("That recording is too large to send — the limit is 50MB.");
            return;
          }
          const ext = (mimeType || "audio/webm").split("/")[1].split(";")[0];
          const file = new File([blob], `voice-note.${ext}`, { type: blob.type });
          onSendFile(file, { type: "voice_note", durationMs });
        }
      };
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setElapsedSec(0);
      tickRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access is needed to record a voice note.");
    }
  }

  function stopRecording(discard: boolean) {
    if (tickRef.current) clearInterval(tickRef.current);
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (discard) {
      recorder.onstop = () => streamRef.current?.getTracks().forEach((t) => t.stop());
    }
    if (recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
  }

  if (isRecording) {
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");
    return (
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-input px-3 py-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm text-muted-foreground">Recording… {mm}:{ss}</span>
          <button
            onClick={() => stopRecording(true)}
            title="Discard"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={() => stopRecording(false)}
            title="Send voice note"
            className="grid h-8 w-8 place-items-center rounded-full bg-gold text-background hover:opacity-90 cursor-pointer"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="border-t border-border/60 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2">
          {pending.kind === "image" && pending.previewUrl && (
            <img src={pending.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
          )}
          {pending.kind === "video" && pending.previewUrl && (
            <video src={pending.previewUrl} className="h-14 w-14 shrink-0 rounded-md object-cover" muted />
          )}
          {pending.kind === "file" && (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-background/40">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{pending.file.name}</div>
            <div className="text-xs text-muted-foreground">{fmtFileSize(pending.file.size)}</div>
          </div>
          <button
            onClick={cancelPending}
            title="Remove"
            disabled={sending}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-end gap-2">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmSend();
              }
            }}
            placeholder="Add a caption (optional)…"
            disabled={sending}
            className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold disabled:opacity-50"
          />
          <button
            onClick={confirmSend}
            disabled={sending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/60 p-3">
      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} hidden onChange={handleFilePicked} />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach a file"
          disabled={sending}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendText();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
        />
        {draft.trim() ? (
          <button
            onClick={onSendText}
            disabled={sending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={sending}
            title="Record a voice note"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-background transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
