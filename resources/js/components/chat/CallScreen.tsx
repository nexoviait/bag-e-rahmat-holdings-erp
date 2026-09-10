import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/pages/project-tabs/chat/Avatar";
import { Call } from "@/pages/project-tabs/chat/types";
import { useCallPeer } from "@/hooks/useCallPeer";

function RemoteVideoTile({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />;
}

export function CallScreen({
  call,
  myUserId,
  onHangup,
}: {
  call: Call;
  myUserId: number;
  onHangup: () => void;
}) {
  const isVideo = call.type === "video";
  const others = (call.participants ?? []).filter((p) => p.user_id !== myUserId);
  const joinedOthers = others.filter((p) => p.status === "joined");
  const ringingOthers = others.filter((p) => p.status === "ringing");
  const remoteUserIds = joinedOthers.map((p) => p.user_id);

  const { localStream, remoteStreams, micEnabled, camEnabled, mediaError, toggleMic, toggleCamera } = useCallPeer({
    callId: call.id,
    myUserId,
    remoteUserIds,
    isVideo,
    active: true,
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (call.status !== "ongoing" || !call.started_at) return;
    const startMs = new Date(call.started_at).getTime();
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [call.status, call.started_at]);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  // Always a single column on mobile — a 1:1 call's two tiles squeezed
  // side-by-side on a phone would each be an unusably thin sliver. Widens to
  // a roughly-square grid once there's room for it. These are literal string
  // branches (not a template-interpolated class name) so Tailwind's build-time
  // class scanner actually finds and generates all three variants.
  const tileCount = 1 + others.length;
  const gridColsClass =
    tileCount <= 1
      ? "grid-cols-1"
      : tileCount <= 4
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="px-5 py-4 text-center">
        <div className="truncate text-sm font-semibold">
          {joinedOthers.length > 0 ? joinedOthers.map((p) => p.name).join(", ") : "Calling…"}
        </div>
        <div className="text-xs text-muted-foreground">
          {call.status === "ongoing" ? `${mm}:${ss}` : ringingOthers.length > 0 ? "Ringing…" : ""}
        </div>
      </div>

      {mediaError && (
        <div className="mx-5 mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
          {mediaError}
        </div>
      )}

      {/* overflow-y-auto, not -hidden — stacked single-column tiles on a
          phone (up to 6 participants) won't all fit vertically without it.
          auto-rows-[minmax(160px,1fr)]: rows still stretch to fill the
          screen when there's room, but never shrink below a usable size —
          plain auto-rows-fr would instead cram every tile paper-thin to
          avoid scrolling, which is worse than just scrolling. */}
      <div
        className={`grid flex-1 auto-rows-[minmax(160px,1fr)] gap-2 overflow-y-auto p-4 ${gridColsClass}`}
      >
        <div className="relative overflow-hidden rounded-xl bg-surface-2">
          {isVideo && camEnabled ? (
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center">
              <Avatar name="You" size={64} />
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded bg-background/60 px-1.5 py-0.5 text-[10px]">
            You{!micEnabled && " · muted"}
          </span>
        </div>

        {joinedOthers.map((p) => (
          <div key={p.user_id} className="relative overflow-hidden rounded-xl bg-surface-2">
            {isVideo && remoteStreams[p.user_id] ? (
              <RemoteVideoTile stream={remoteStreams[p.user_id]} />
            ) : (
              <div className="grid h-full place-items-center">
                <Avatar name={p.name ?? "?"} size={64} />
              </div>
            )}
            <span className="absolute bottom-2 left-2 rounded bg-background/60 px-1.5 py-0.5 text-[10px]">
              {p.name}
            </span>
          </div>
        ))}

        {ringingOthers.map((p) => (
          <div key={p.user_id} className="relative grid place-items-center overflow-hidden rounded-xl bg-surface-2/50">
            <Avatar name={p.name ?? "?"} size={64} />
            <span className="absolute bottom-2 left-2 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {p.name} · ringing…
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pb-10 pt-2">
        <button
          onClick={toggleMic}
          title={micEnabled ? "Mute" : "Unmute"}
          className={`grid h-12 w-12 place-items-center rounded-full transition cursor-pointer ${
            micEnabled ? "bg-surface-2 hover:bg-accent" : "bg-destructive text-white hover:opacity-90"
          }`}
        >
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleCamera}
            title={camEnabled ? "Turn camera off" : "Turn camera on"}
            className={`grid h-12 w-12 place-items-center rounded-full transition cursor-pointer ${
              camEnabled ? "bg-surface-2 hover:bg-accent" : "bg-destructive text-white hover:opacity-90"
            }`}
          >
            {camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        )}

        <button
          onClick={onHangup}
          title="Hang up"
          className="grid h-14 w-14 place-items-center rounded-full bg-destructive text-white shadow-lg transition hover:opacity-90 cursor-pointer"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
