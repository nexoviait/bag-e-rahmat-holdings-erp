import React, { useState, useRef } from "react";
import {
  X,
  Loader2,
  RefreshCw,
  Camera as CameraIcon,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Video,
  ZoomIn,
  Compass,
} from "lucide-react";
import { useWhepPlayer } from "@/hooks/useWhepPlayer";
import { PtzControlPanel } from "./PtzControlPanel";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { withConcurrencyLimit } from "@/lib/concurrencyLimiter";

export function LivePlayerModal({ camera, onClose }: { camera: any; onClose: () => void }) {
  const [streamQuality, setStreamQuality] = useState<"main" | "sub">("main");
  const { videoRef, status, usingFallback, error, retryCount, retryNow } = useWhepPlayer(camera.id, streamQuality, true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [digitalZoom, setDigitalZoom] = useState<number>(1);
  const [showPtz, setShowPtz] = useState<boolean>(false);
  const [useSnapshotMode, setUseSnapshotMode] = useState<boolean>(false);
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const isSecure = typeof window === "undefined" || window.isSecureContext;

  // Auto-enable snapshot stream fallback when MediaMTX WebRTC is offline
  React.useEffect(() => {
    if (status === "error" && !useSnapshotMode) {
      setUseSnapshotMode(true);
    }
  }, [status, useSnapshotMode]);

  // Snapshot stream fallback effect. Backs off exponentially on repeated
  // failures (capped at 20s) instead of a fixed 1s interval — polling an
  // unreachable camera every second is what backed up the single-worker dev
  // server and stalled unrelated pages. Resets to the 2s base rate as soon
  // as frames start succeeding again, so it self-heals with no manual retry
  // needed once the DVR/MediaMTX actually comes online.
  React.useEffect(() => {
    if (!useSnapshotMode) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let consecutiveFailures = 0;

    async function fetchFrame() {
      if (!active) return;

      try {
        const res = await withConcurrencyLimit(() =>
          api.get(`/cctv/snapshot/${camera.id}`, { responseType: "blob" })
        );
        if (!active) return;
        consecutiveFailures = 0;
        const url = URL.createObjectURL(res.data);
        setSnapshotSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        consecutiveFailures += 1;
      }

      if (!active) return;
      const delay = consecutiveFailures === 0 ? 2000 : Math.min(2000 * 2 ** consecutiveFailures, 20000);
      timer = setTimeout(fetchFrame, delay);
    }

    fetchFrame();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [useSnapshotMode, camera.id]);

  function toggleAudio() {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }

  function handleFullscreen() {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  }

  function takeSnapshot() {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageUri = canvas.toDataURL("image/jpeg");
        const a = document.createElement("a");
        a.href = imageUri;
        a.download = `snapshot_${camera.camera_name}_${new Date().toISOString()}.jpg`;
        a.click();
        toast.success("Snapshot downloaded");
      }
    } catch {
      toast.error("Failed to capture snapshot");
    }
  }

  function toggleRecording() {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      if (!videoRef.current) return;
      try {
        const stream = (videoRef.current as any).captureStream
          ? (videoRef.current as any).captureStream()
          : (videoRef.current as any).mozCaptureStream
          ? (videoRef.current as any).mozCaptureStream()
          : null;

        if (!stream) {
          toast.error("Stream capture not supported in this browser");
          return;
        }

        recordedChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `recording_${camera.camera_name}_${new Date().toISOString()}.webm`;
          a.click();
          toast.success("Recording downloaded successfully");
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        toast.info("Recording live stream...");
      } catch (err: any) {
        toast.error("Recording error: " + err.message);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur overflow-y-auto">
      <div className="noir-panel w-full max-w-5xl overflow-hidden my-auto">
        {/* Header — camera name always gets priority for space; the device
            name and PTZ label are secondary context that collapse first on
            narrow screens rather than squeezing the title down to "Ch.4 …". */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CameraIcon className="h-4 w-4 shrink-0 text-gold" />
            <h3 className="min-w-0 truncate font-display text-base font-semibold sm:text-lg">
              Ch.{camera.channel_number} {camera.camera_name}
            </h3>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              ({camera.device?.device_name ?? "DVR"})
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowPtz(!showPtz)}
              title="PTZ Control"
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition cursor-pointer sm:px-3 sm:py-1 ${
                showPtz ? "bg-gold text-slate-950" : "bg-surface-2 text-foreground hover:bg-surface-2/80"
              }`}
            >
              <Compass className="h-4 w-4" /> <span className="hidden sm:inline">PTZ Control</span>
            </button>
            <button onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-accent cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!isSecure && (
          <div className="flex items-center gap-2 border-b border-border/60 bg-warning/10 px-4 py-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            This page isn't served over HTTPS — live streaming may not work in this browser until it is.
          </div>
        )}

        <div className="flex flex-col lg:flex-row">
          {/* Main Video Player Container */}
          <div className="relative flex-1 aspect-video bg-black overflow-hidden">
            <div
              className="w-full h-full transition-transform duration-200"
              style={{ transform: `scale(${digitalZoom})`, transformOrigin: "center center" }}
            >
              {useSnapshotMode ? (
                snapshotSrc ? (
                  <img src={snapshotSrc} alt="Snapshot stream" className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-gold" /> Loading snapshot stream…
                  </div>
                )
              ) : (
                <video ref={videoRef} autoPlay playsInline muted={isMuted} className="h-full w-full object-contain" />
              )}
            </div>

            {!useSnapshotMode && status !== "connected" && (
              <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-sm text-muted-foreground z-20">
                {status === "connecting" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gold" /> Connecting stream…
                  </div>
                )}
                {status === "reconnecting" && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-gold" /> Reconnecting (Attempt {retryCount}/2)…
                  </div>
                )}
                {status === "error" && (
                  <div className="flex flex-col items-center gap-3 p-5 max-w-md bg-surface-1/95 rounded-xl border border-border/80 text-foreground shadow-2xl">
                    <div className="rounded-full bg-warning/15 p-3 text-warning">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="text-base font-semibold">Streaming Server Unreachable</div>
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      {error || "MediaMTX streaming proxy is not running on 127.0.0.1:8889 / 8888 (net::ERR_CONNECTION_REFUSED)."}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          setUseSnapshotMode(true);
                          toast.info("Switched to Snapshot Stream Mode");
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-gold text-slate-950 font-semibold text-xs hover:bg-gold/90 transition cursor-pointer"
                      >
                        Use Snapshot Stream Mode
                      </button>
                      <button
                        onClick={() => {
                          setUseSnapshotMode(false);
                          retryNow();
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-surface-2 text-foreground font-semibold text-xs hover:bg-surface-2/80 transition cursor-pointer"
                      >
                        Retry WebRTC Stream
                      </button>
                    </div>
                  </div>
                )}
                {status === "idle" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gold" /> Starting stream…
                  </div>
                )}
              </div>
            )}

            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse z-20 shadow">
                <span className="h-2 w-2 rounded-full bg-white" /> REC
              </div>
            )}

            {useSnapshotMode && (
              <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-gold/40 bg-black/75 px-3 py-1 text-[11px] font-semibold text-gold z-20 backdrop-blur shadow">
                <span className="h-2 w-2 rounded-full bg-gold animate-ping" /> Live Snapshot Stream (MediaMTX Offline)
              </div>
            )}

            {usingFallback && status === "connected" && !useSnapshotMode && (
              <div className="absolute right-3 top-3 rounded-full border border-warning/40 bg-warning/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning z-20">
                Using HLS fallback stream
              </div>
            )}
          </div>

          {/* PTZ Drawer Panel (if toggled) */}
          {showPtz && (
            <div className="p-4 border-l border-border/60 bg-surface-1/40 shrink-0">
              <PtzControlPanel cameraId={camera.id} cameraName={camera.camera_name} />
            </div>
          )}
        </div>

        {/* Video Control Bar */}
        <div className="flex flex-wrap items-center justify-between p-3 border-t border-border/60 bg-surface-2/40 text-xs text-muted-foreground gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              className="p-1.5 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-gold" />}
            </button>

            <button
              onClick={takeSnapshot}
              className="p-1.5 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Snapshot JPEG"
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              onClick={toggleRecording}
              className={`p-1.5 rounded transition cursor-pointer ${
                isRecording ? "bg-red-500 text-white" : "bg-surface-2 hover:text-gold"
              }`}
              title={isRecording ? "Stop Recording" : "Record Stream"}
            >
              <Video className="h-4 w-4" />
            </button>

            <button
              onClick={handleFullscreen}
              className="p-1.5 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </button>

            {/* Digital Zoom Controller */}
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/60">
              <ZoomIn className="h-3.5 w-3.5 text-gold" />
              <span className="text-[10px]">Zoom:</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.5"
                value={digitalZoom}
                onChange={(e) => setDigitalZoom(Number(e.target.value))}
                className="w-16 h-1 bg-surface-2 rounded appearance-none cursor-pointer accent-gold"
              />
              <span className="font-bold text-[10px] text-foreground">{digitalZoom}x</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quality Switcher */}
            <div className="flex rounded border border-border overflow-hidden">
              <button
                onClick={() => setStreamQuality("main")}
                className={`px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                  streamQuality === "main" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                }`}
              >
                HD Main
              </button>
              <button
                onClick={() => setStreamQuality("sub")}
                className={`px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                  streamQuality === "sub" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground"
                }`}
              >
                SD Sub
              </button>
            </div>

            <button
              onClick={retryNow}
              className="inline-flex items-center gap-1 rounded px-2 py-1 bg-surface-2 hover:text-gold transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
