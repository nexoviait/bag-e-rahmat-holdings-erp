import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { withConcurrencyLimit } from "@/lib/concurrencyLimiter";

export type WhepStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

// Auto-reconnect requirement: on a failed/dropped connection, retry
// automatically (with backoff) up to this many times before finally
// settling on "error" and requiring a manual Retry click.
const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFF_MS = [2000, 5000];

// MediaMTX pulls the DVR's RTSP source lazily, on the first request for a
// given path — if the DVR is slow to respond, hitting its concurrent-session
// limit, or (as here) stalls delivering a codec the browser can't decode,
// the WHEP POST can simply hang with no response at all. fetch() has no
// built-in timeout, so without this a stuck tile spins forever: no error is
// ever thrown, so retry/backoff and the snapshot fallback never trigger.
const WHEP_TIMEOUT_MS = 8000;

export function useWhepPlayer(cameraId: number, quality: "main" | "sub" = "main", enabled: boolean = true) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mountedRef = useRef<boolean>(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const [status, setStatus] = useState<WhepStatus>("idle");
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attemptConnect = useCallback(async () => {
    cleanup();
    if (!enabled || !cameraId || !mountedRef.current) return;

    setStatus(attemptRef.current > 0 ? "reconnecting" : "connecting");
    setError(null);
    setUsingFallback(false);

    const succeed = () => {
      attemptRef.current = 0;
      setRetryCount(0);
    };

    // On failure: auto-retry with backoff up to MAX_AUTO_RETRIES times, then
    // settle on "error" for the user to retry manually via retryNow().
    const failAndMaybeRetry = (msg: string) => {
      if (!mountedRef.current) return;
      setError(msg);

      if (attemptRef.current >= MAX_AUTO_RETRIES) {
        setStatus("error");
        return;
      }

      attemptRef.current += 1;
      setRetryCount(attemptRef.current);
      const delay = RETRY_BACKOFF_MS[attemptRef.current - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      retryTimerRef.current = setTimeout(() => attemptConnect(), delay);
    };

    try {
      // Mint live stream URLs from the API. Shares the same concurrency
      // limit as snapshot fetches — a grid of tiles all connecting (or
      // reconnecting) at once must not fire this many simultaneous mint+WHEP
      // negotiations, or it reproduces the exact server/DVR overload that
      // limit exists to prevent.
      const res = await withConcurrencyLimit(() => api.post(`/cctv/live/${cameraId}`, { quality }));
      const { webrtc_url, hls_url } = res.data;

      if (!mountedRef.current) return;

      // 1. Try WebRTC / WHEP streaming first.
      if (webrtc_url) {
        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          pcRef.current = pc;

          pc.addTransceiver("video", { direction: "recvonly" });
          pc.addTransceiver("audio", { direction: "recvonly" });

          pc.ontrack = (event) => {
            if (videoRef.current && event.streams[0] && mountedRef.current) {
              videoRef.current.srcObject = event.streams[0];
              setStatus("connected");
              succeed();
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const abortController = new AbortController();
          const timeoutTimer = setTimeout(() => abortController.abort(), WHEP_TIMEOUT_MS);
          let whepRes: Response;
          try {
            whepRes = await fetch(webrtc_url, {
              method: "POST",
              headers: { "Content-Type": "application/sdp" },
              body: offer.sdp,
              signal: abortController.signal,
            });
          } finally {
            clearTimeout(timeoutTimer);
          }

          if (whepRes.ok) {
            const answerSdp = await whepRes.text();
            if (mountedRef.current && pcRef.current) {
              await pcRef.current.setRemoteDescription({ type: "answer", sdp: answerSdp });
              setStatus("connected");
              succeed();
              return;
            }
          }
        } catch (whepErr: any) {
          console.warn("WHEP connection failed:", whepErr.message || whepErr);
        }
      }

      // 2. Fall back to HLS if the native video element supports it.
      if (hls_url && videoRef.current) {
        try {
          videoRef.current.src = hls_url;
          await videoRef.current.play();
          if (mountedRef.current) {
            setUsingFallback(true);
            setStatus("connected");
            succeed();
            return;
          }
        } catch (hlsErr: any) {
          console.warn("HLS playback failed:", hlsErr.message || hlsErr);
        }
      }

      failAndMaybeRetry("MediaMTX streaming server is offline.");
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err.response?.data?.message || err.message || "Failed to initialize stream.";
      failAndMaybeRetry(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, quality, enabled, cleanup]);

  const retryNow = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    attemptRef.current = 0;
    setRetryCount(0);
    attemptConnect();
  }, [attemptConnect]);

  useEffect(() => {
    mountedRef.current = true;
    attemptRef.current = 0;
    setRetryCount(0);
    attemptConnect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [attemptConnect, cleanup]);

  return {
    videoRef,
    status,
    usingFallback,
    error,
    retryCount,
    retryNow,
  };
}
