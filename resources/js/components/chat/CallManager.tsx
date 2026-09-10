import { createContext, useContext, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEcho } from "@laravel/echo-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Call } from "@/pages/project-tabs/chat/types";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallScreen } from "./CallScreen";

type CallContextValue = {
  startCall: (conversationId: number, type: "audio" | "video") => void;
  inCall: boolean;
};

const CallContext = createContext<CallContextValue>({
  startCall: () => {},
  inCall: false,
});

export function useCall() {
  return useContext(CallContext);
}

/** Only mounted while a call exists — keeps the "which channel to subscribe to" question out of useEcho's own conditional-hook territory. */
function ActiveCallSync({ callId, onUpdate }: { callId: number; onUpdate: (call: Call) => void }) {
  useEcho<Call>(`chat.call.${callId}`, ".call.status_updated", onUpdate, [callId]);
  return null;
}

/**
 * Mounted once, globally, in AppShell — same reasoning as ChatIncomingListener:
 * an incoming call has to ring regardless of which page (or which project's
 * Chat tab) the recipient currently has open.
 */
export function CallManager({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const myId = Number(user?.id);
  const [call, setCall] = useState<Call | null>(null);

  useEcho<Call>(`chat.user.${myId}`, ".call.ringing", (payload) => {
    // Already on a call (or already tracking this same ring from another
    // event) — don't clobber it with the raw "just started ringing" payload.
    setCall((current) => current ?? payload);
  });

  useEffect(() => {
    if (!call) return;
    if (call.status === "ended" || call.status === "missed" || call.status === "declined") {
      const label =
        call.status === "missed" ? "Missed call" : call.status === "declined" ? "Call declined" : "Call ended";
      toast.message(label);
      setCall(null);
    }
  }, [call]);

  const startCallMutation = useMutation({
    mutationFn: async ({ conversationId, type }: { conversationId: number; type: "audio" | "video" }) =>
      (await api.post<Call>(`/chat/conversations/${conversationId}/calls`, { type })).data,
    onSuccess: (newCall) => setCall(newCall),
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to start call."),
  });

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.post<Call>(`/chat/calls/${call!.id}/accept`)).data,
    onSuccess: (updated) => setCall(updated),
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to accept call.");
      setCall(null);
    },
  });
  const declineMutation = useMutation({
    mutationFn: async () => (await api.post<Call>(`/chat/calls/${call!.id}/decline`)).data,
    onSuccess: () => setCall(null),
    onError: () => setCall(null),
  });
  const endMutation = useMutation({
    mutationFn: async () => (await api.post<Call>(`/chat/calls/${call!.id}/end`)).data,
    onSuccess: () => setCall(null),
    onError: () => setCall(null),
  });

  function startCall(conversationId: number, type: "audio" | "video") {
    if (call) {
      toast.error("You're already in a call.");
      return;
    }
    startCallMutation.mutate({ conversationId, type });
  }

  const myParticipant = call?.participants?.find((p) => p.user_id === myId);
  const isRingingIncoming = !!call && myParticipant?.status === "ringing";
  const isJoined = !!call && myParticipant?.status === "joined" && (call.status === "ringing" || call.status === "ongoing");

  return (
    <CallContext.Provider value={{ startCall, inCall: !!call }}>
      {children}

      {call && <ActiveCallSync callId={call.id} onUpdate={setCall} />}

      {isRingingIncoming && call && (
        <IncomingCallModal
          call={call}
          onAccept={() => acceptMutation.mutate()}
          onDecline={() => declineMutation.mutate()}
          responding={acceptMutation.isPending || declineMutation.isPending}
        />
      )}

      {isJoined && call && (
        <CallScreen call={call} myUserId={myId} onHangup={() => endMutation.mutate()} />
      )}
    </CallContext.Provider>
  );
}
