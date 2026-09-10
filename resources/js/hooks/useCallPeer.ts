import { useCallback, useEffect, useRef, useState } from "react";
import { useEcho } from "@laravel/echo-react";

type SignalPayload = {
  kind: "offer" | "answer" | "ice";
  from: number;
  to: number;
  data: any;
};

/**
 * Mesh WebRTC for group calls — every participant connects directly to
 * every other (no SFU/media-server in budget), capped at 6 participants
 * elsewhere (CallService::MAX_PARTICIPANTS) since mesh quality degrades
 * badly beyond that. SDP/ICE exchange rides Echo "whispers" on the call's
 * own channel — never a real broadcast event, so a dozen+ ICE candidates
 * per peer pair never touch Laravel/the DB/the queue, just like typing
 * indicators. STUN-only (stun.l.google.com, same as CCTV's useWhepPlayer) —
 * no TURN server in V1, a disclosed limitation: two participants both
 * behind strict/symmetric NATs can fail to connect to each other.
 *
 * Offer/answer glare is avoided with a simple deterministic rule: whichever
 * side has the lower user id always initiates the offer for that pair. Both
 * sides independently compute the same answer, so there's never a race
 * over who proposes first, regardless of which side's data arrives first.
 */
export function useCallPeer({
  callId,
  myUserId,
  remoteUserIds,
  isVideo,
  active,
}: {
  callId: number;
  myUserId: number;
  /** The other participants I should currently hold a live connection to (their 'joined' status). */
  remoteUserIds: number[];
  isVideo: boolean;
  /** Gate — no local media is requested and no connections are made until this is true. */
  active: boolean;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(isVideo);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const mountedRef = useRef(true);

  const channelName = `chat.call.${callId}`;

  const createPeerConnection = useCallback(
    (otherUserId: number, isOfferer: boolean, whisper: (event: string, data: any) => void) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peersRef.current.set(otherUserId, pc);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        if (!mountedRef.current) return;
        setRemoteStreams((s) => ({ ...s, [otherUserId]: event.streams[0] }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          whisper("signal", { kind: "ice", from: myUserId, to: otherUserId, data: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          if (mountedRef.current) {
            setRemoteStreams((s) => {
              if (!(otherUserId in s)) return s;
              const next = { ...s };
              delete next[otherUserId];
              return next;
            });
          }
        }
      };

      if (isOfferer) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => whisper("signal", { kind: "offer", from: myUserId, to: otherUserId, data: offer }))
          .catch((err) => console.warn("Failed to create call offer:", err));
      }

      return pc;
    },
    [myUserId]
  );

  const { channel } = useEcho<SignalPayload>(
    channelName,
    ".client-signal",
    (payload) => {
      if (!payload || payload.to !== myUserId) return;

      const pc = peersRef.current.get(payload.from);
      const whisper = (event: string, data: any) => channel()?.whisper(event, data);

      if (payload.kind === "offer") {
        const conn = pc ?? createPeerConnection(payload.from, false, whisper);
        conn
          .setRemoteDescription(new RTCSessionDescription(payload.data))
          .then(() => conn.createAnswer())
          .then((answer) => conn.setLocalDescription(answer).then(() => answer))
          .then((answer) => whisper("signal", { kind: "answer", from: myUserId, to: payload.from, data: answer }))
          .catch((err) => console.warn("Failed to answer call offer:", err));
      } else if (payload.kind === "answer" && pc) {
        pc.setRemoteDescription(new RTCSessionDescription(payload.data)).catch((err) =>
          console.warn("Failed to set call answer:", err)
        );
      } else if (payload.kind === "ice" && pc) {
        pc.addIceCandidate(new RTCIceCandidate(payload.data)).catch((err) =>
          console.warn("Failed to add ICE candidate:", err)
        );
      }
    },
    [callId]
  );

  // Acquire local media once the call becomes active.
  useEffect(() => {
    if (!active) return;
    mountedRef.current = true;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: isVideo })
      .then((stream) => {
        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch(() => setMediaError("Camera/microphone access is needed for calls."));

    return () => {
      mountedRef.current = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isVideo]);

  // Reconcile peer connections against the current live participant list —
  // open one for anyone new, close one for anyone who left.
  const remoteIdsKey = [...remoteUserIds].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!active || !localStream) return;
    const whisper = (event: string, data: any) => channel()?.whisper(event, data);

    for (const otherId of remoteUserIds) {
      if (otherId === myUserId || peersRef.current.has(otherId)) continue;
      createPeerConnection(otherId, myUserId < otherId, whisper);
    }

    for (const [otherId, pc] of peersRef.current) {
      if (!remoteUserIds.includes(otherId)) {
        pc.close();
        peersRef.current.delete(otherId);
        setRemoteStreams((s) => {
          if (!(otherId in s)) return s;
          const next = { ...s };
          delete next[otherId];
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, localStream, remoteIdsKey, myUserId, createPeerConnection]);

  const toggleMic = useCallback(() => {
    const next = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleCamera = useCallback(() => {
    const next = !camEnabled;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamEnabled(next);
  }, [camEnabled]);

  return { localStream, remoteStreams, micEnabled, camEnabled, mediaError, toggleMic, toggleCamera };
}
