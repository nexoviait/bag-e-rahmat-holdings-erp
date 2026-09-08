import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { useWhepPlayer } from "@/hooks/useWhepPlayer";
import { withConcurrencyLimit } from "@/lib/concurrencyLimiter";
import { StatusBadge } from "@/pages/project-tabs/CctvTab";

// Spreads each tile's initial connection attempt across this window instead
// of all firing in the same instant — even with the shared concurrency
// limiter queuing the network calls, a real DVR's RTSP server can only hold
// so many concurrent sessions open (commonly 4-6 on embedded hardware), so
// staggering start times gives earlier tiles a chance to finish negotiating
// before the next batch begins rather than everyone racing for a slot at once.
const STAGGER_MAX_MS = 6000;
const FALLBACK_POLL_MS = 12000;

/**
 * Attempts REAL live video (substream — the grid is many tiles at once, so
 * this always requests "sub" quality, never "main") in every grid tile
 * rather than a periodic snapshot. This is a real hardware trade-off, not
 * just a UI choice: one physical DVR is very likely to reject some of these
 * connections once too many are open simultaneously. Any tile whose stream
 * can't connect automatically falls back to snapshot polling instead of
 * showing a dead tile — so a grid full of cameras still shows *something*
 * for every camera even if not all 16 can hold a live connection at once.
 *
 * Deliberately does NOT gate the attempt on camera.status. That field is
 * only ever corrected opportunistically — when a camera is actually viewed
 * (see LiveStreamService) — so "unknown"/"offline" doesn't mean "this is
 * broken," it usually just means "nobody has looked at this one yet." Gating
 * on it here would mean those tiles never even try automatically and only
 * ever recover if someone happens to open them individually via the full
 * player modal (which has no such gate) — exactly the "works after I click
 * it, but not on its own" bug this fixes. Staggering the start times is what
 * actually keeps this safe against the DVR's connection limits, not status.
 */
export function GridVideoTile({ camera, onOpenLive }: { camera: any; onOpenLive: (camera: any) => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), Math.random() * STAGGER_MAX_MS);
    return () => clearTimeout(timer);
  }, [camera.id]);

  const { videoRef, status } = useWhepPlayer(camera.id, "sub", ready);
  const useSnapshotFallback = ready && status === "error";

  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await withConcurrencyLimit(() =>
        api.get(`/cctv/snapshot/${camera.id}`, { responseType: "blob" })
      );
      const url = URL.createObjectURL(res.data);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setSnapshotSrc(url);
    } catch {
      // Leave the last-good frame on failure.
    }
  }, [camera.id]);

  useEffect(() => {
    if (!useSnapshotFallback) return;
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [useSnapshotFallback, fetchSnapshot]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return (
    <button
      onClick={() => onOpenLive(camera)}
      className="group relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-black cursor-pointer"
    >
      {!ready ? (
        <div className="grid h-full place-items-center text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
      ) : useSnapshotFallback ? (
        snapshotSrc ? (
          <img src={snapshotSrc} alt={camera.camera_name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {status !== "connected" && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          )}
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2">
        <span className="truncate text-xs font-medium text-white">
          Ch.{camera.channel_number} {camera.camera_name}
        </span>
        <StatusBadge status={camera.status} />
      </div>

      <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
        <PlayCircle className="h-8 w-8 text-white" />
      </div>
    </button>
  );
}
