import { Loader2, Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "@/pages/project-tabs/chat/Avatar";
import { Call } from "@/pages/project-tabs/chat/types";

export function IncomingCallModal({
  call,
  onAccept,
  onDecline,
  responding,
}: {
  call: Call;
  onAccept: () => void;
  onDecline: () => void;
  responding: boolean;
}) {
  const callerName = call.initiator?.name ?? "Someone";
  const isVideo = call.type === "video";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="noir-panel flex w-full max-w-xs flex-col items-center gap-5 p-8 text-center">
        <div className="relative">
          <span className="absolute inset-0 -m-3 animate-ping rounded-full bg-gold/20" />
          <Avatar name={callerName} size={80} />
        </div>
        <div>
          <div className="font-display text-lg font-semibold">{callerName}</div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            {isVideo ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
            Incoming {isVideo ? "video" : "voice"} call…
          </div>
        </div>

        <div className="mt-2 flex items-center gap-6">
          <button
            onClick={onDecline}
            disabled={responding}
            title="Decline"
            className="grid h-14 w-14 place-items-center rounded-full bg-destructive text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {responding ? <Loader2 className="h-6 w-6 animate-spin" /> : <PhoneOff className="h-6 w-6" />}
          </button>
          <button
            onClick={onAccept}
            disabled={responding}
            title="Accept"
            className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {responding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Phone className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
