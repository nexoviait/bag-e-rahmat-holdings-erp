import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEcho } from "@laravel/echo-react";
import { api } from "@/lib/api";
import { useSession, useIsAdmin, useHasPermission } from "@/lib/session";
import { ArrowLeft, Check, CheckCheck, Loader2, Phone, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Conversation, ChatMessage } from "./types";
import { Avatar } from "./Avatar";
import { formatBubbleTime, formatLastSeen } from "./chatTime";
import { MessageComposer } from "./MessageComposer";
import { ChatAttachment } from "./ChatAttachment";
import { ChatInfoPanel } from "./ChatInfoPanel";
import { useCall } from "@/components/chat/CallManager";

/**
 * Typing indicators are Echo "whispers" (client events) only — never a real
 * broadcast event, so they never touch Laravel, the DB, or the queue. See
 * the Chat plan's verification checklist: a direct look at the messages/jobs
 * tables must show neither gains a row while someone types.
 */
export function MessageThread({
  conversation,
  projectId,
  onBack,
  onlineUserIds,
}: {
  conversation: Conversation;
  // The route-param string, NOT conversation.project_id (a number from the
  // API payload) — ChatTab's conversations-list query is keyed on this exact
  // string, and TanStack Query's invalidateQueries does a strict per-element
  // match on the key array, so invalidating with a number here would silently
  // no-op against a key registered with a string and never actually refetch.
  projectId: string;
  onBack?: () => void;
  onlineUserIds: Set<number>;
}) {
  const { user } = useSession();
  const isGlobalAdmin = useIsAdmin();
  const canInitiateCalls = useHasPermission("chat.calls.initiate");
  const { startCall, inCall } = useCall();
  const myId = Number(user?.id);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const lastWhisperSentAt = useRef(0);
  const typingClearTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const prevLastMessageIdRef = useRef<number | null>(null);

  const MESSAGES_PAGE_SIZE = 30;
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messagesKey = ["chat", "messages", conversation.id] as const;

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: async () => {
      const data = (
        await api.get<ChatMessage[]>(`/chat/conversations/${conversation.id}/messages`, {
          params: { limit: MESSAGES_PAGE_SIZE },
        })
      ).data;
      // A page shorter than the request size means there's nothing older
      // left — switching conversations re-runs this queryFn fresh (new
      // query key) so this naturally re-evaluates per conversation too.
      setHasMoreOlder(data.length >= MESSAGES_PAGE_SIZE);
      return data;
    },
  });

  const messages = messagesQuery.data ?? [];

  async function loadOlderMessages() {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;

    setLoadingOlder(true);
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    try {
      const oldestId = messages[0].id;
      const older = (
        await api.get<ChatMessage[]>(`/chat/conversations/${conversation.id}/messages`, {
          params: { before_id: oldestId, limit: MESSAGES_PAGE_SIZE },
        })
      ).data;

      setHasMoreOlder(older.length >= MESSAGES_PAGE_SIZE);

      if (older.length > 0) {
        qc.setQueryData<ChatMessage[]>(messagesKey, (old) => [...older, ...(old ?? [])]);
        // Prepending above the current scroll position would otherwise yank
        // the view down to the (now much longer) top — restore exactly
        // where the reader was, same trick every chat app's "load earlier"
        // uses, once the DOM has actually grown to its new height.
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch {
      toast.error("Failed to load earlier messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  // Auto-loads the next page once the sentinel above the oldest loaded
  // message scrolls into view — the standard infinite-scroll-upward pattern,
  // rather than requiring a manual "load more" click.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || messagesQuery.isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOlderMessages();
      },
      { root: container, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, hasMoreOlder, messagesQuery.isLoading, messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) =>
      (await api.post<ChatMessage>(`/chat/conversations/${conversation.id}/messages`, { body })).data,
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(messagesKey, (old) => [...(old ?? []), msg]);
      qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
      setDraft("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to send message.");
    },
  });

  const sendAttachment = useMutation({
    mutationFn: async ({
      file,
      type,
      durationMs,
      caption,
    }: {
      file: File;
      type?: "voice_note";
      durationMs?: number;
      caption?: string;
    }) => {
      const form = new FormData();
      form.append("attachment", file);
      if (type) form.append("type", type);
      if (durationMs) form.append("attachment_duration_ms", String(Math.round(durationMs)));
      if (caption) form.append("body", caption);
      // postForm(), not post() — this axios instance's default
      // Content-Type: application/json header (see lib/api.ts) would
      // otherwise make axios's transformRequest JSON.stringify the FormData
      // instead of sending it as a real multipart body. postForm() overrides
      // that per-request so the browser sets its own boundary-bearing
      // multipart Content-Type instead.
      return (await api.postForm<ChatMessage>(`/chat/conversations/${conversation.id}/messages`, form)).data;
    },
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(messagesKey, (old) => [...(old ?? []), msg]);
      qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to send attachment.");
    },
  });

  const markRead = useMutation({
    mutationFn: async () => api.post(`/chat/conversations/${conversation.id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] }),
  });

  // Both of these key off the LATEST message's id specifically, not
  // messages.length — loadOlderMessages() also changes .length by
  // prepending older history, which should neither re-trigger a "mark read"
  // call nor yank the view down to the bottom while someone is scrolling up
  // to read old messages.
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    if (lastMessageId !== null) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, lastMessageId]);

  useEffect(() => {
    if (lastMessageId === null) return;
    bottomRef.current?.scrollIntoView({ behavior: prevLastMessageIdRef.current === null ? "auto" : "smooth" });
    prevLastMessageIdRef.current = lastMessageId;
  }, [lastMessageId]);

  const channelName = `chat.conversation.${conversation.id}`;

  const { channel } = useEcho<ChatMessage>(
    channelName,
    ".message.sent",
    (payload) => {
      qc.setQueryData<ChatMessage[]>(messagesKey, (old) => {
        if ((old ?? []).some((m) => m.id === payload.id)) return old;
        return [...(old ?? []), payload];
      });
      qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
    },
    [conversation.id]
  );

  useEcho(
    channelName,
    ".message.read",
    () => {
      // A watermark moved somewhere in this conversation — cheapest correct
      // reaction is just refetching the conversation list (for the read-tick
      // shown against my own last sent message) rather than modelling every
      // participant's watermark locally.
      qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
    },
    [conversation.id]
  );

  useEcho<{ user_id: number; name: string }>(
    channelName,
    ".client-typing",
    (payload) => {
      if (!payload || payload.user_id === myId) return;

      setTypingUsers((t) => ({ ...t, [payload.user_id]: payload.name }));

      clearTimeout(typingClearTimers.current[payload.user_id]);
      typingClearTimers.current[payload.user_id] = setTimeout(() => {
        setTypingUsers((t) => {
          const next = { ...t };
          delete next[payload.user_id];
          return next;
        });
      }, 3000);
    },
    [conversation.id]
  );

  function handleDraftChange(value: string) {
    setDraft(value);

    const now = Date.now();
    if (now - lastWhisperSentAt.current > 2000) {
      lastWhisperSentAt.current = now;
      channel()?.whisper("typing", { user_id: myId, name: user?.name });
    }
  }

  function handleSend() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  }

  function handleSendFile(file: File, opts?: { type?: "voice_note"; durationMs?: number; caption?: string }) {
    sendAttachment.mutate({ file, type: opts?.type, durationMs: opts?.durationMs, caption: opts?.caption });
  }

  const otherParticipant = useMemo(
    () => (conversation.type === "direct" ? conversation.participants?.find((p) => p.user_id !== myId) : null),
    [conversation, myId]
  );
  const isOtherOnline = otherParticipant ? onlineUserIds.has(otherParticipant.user_id) : false;

  const headerSubtitle =
    conversation.type === "group"
      ? `${conversation.participants?.length ?? 0} members`
      : isOtherOnline
      ? "Online"
      : formatLastSeen(otherParticipant?.last_seen_at);

  const typingNames = Object.values(typingUsers);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="rounded-md p-1 hover:bg-accent cursor-pointer sm:hidden">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => setShowInfo(true)}
          title={conversation.type === "group" ? "Group info" : "Contact info"}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition hover:opacity-80 cursor-pointer"
        >
          {conversation.type === "group" ? (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          ) : (
            <Avatar name={conversation.name ?? "?"} size={36} online={isOtherOnline} />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{conversation.name ?? "Untitled"}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {typingNames.length > 0 ? `${typingNames.join(", ")} typing…` : headerSubtitle}
            </div>
          </div>
        </button>

        {canInitiateCalls && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => startCall(conversation.id, "audio")}
              disabled={inCall}
              title="Voice call"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => startCall(conversation.id, "video")}
              disabled={inCall}
              title="Video call"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Video className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollContainerRef} className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messagesQuery.isLoading && (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        )}

        {!messagesQuery.isLoading && messages.length === 0 && (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No messages yet — say hello.
          </div>
        )}

        {!messagesQuery.isLoading && messages.length > 0 && (
          <div ref={topSentinelRef} className="flex justify-center py-1">
            {loadingOlder && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!hasMoreOlder && !loadingOlder && (
              <span className="text-[10px] text-muted-foreground">Start of conversation</span>
            )}
          </div>
        )}

        {messages.map((m, idx) => {
          const isMine = m.sender_id === myId;
          const prev = messages[idx - 1];
          const showSender = conversation.type === "group" && !isMine && (!prev || prev.sender_id !== m.sender_id);

          // "Seen" tick on my own messages: true once every OTHER active
          // participant's last_read_message_id has reached this message.
          const readByOthers =
            isMine &&
            conversation.participants
              ?.filter((p) => p.user_id !== myId)
              .every((p) => (p.last_read_message_id ?? 0) >= m.id);

          // Image/video render as bare media (no colored bubble behind them,
          // matching how every chat app treats media vs. text) — text,
          // voice notes, and file chips keep the padded colored bubble.
          const isBareMedia = m.type === "image" || m.type === "video";

          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                {showSender && (
                  <span className="mb-0.5 ml-1 text-[10px] font-medium text-gold">{m.sender?.name}</span>
                )}
                <div
                  className={
                    isBareMedia
                      ? "overflow-hidden rounded-2xl"
                      : `rounded-2xl px-3.5 py-2 text-sm ${
                          isMine
                            ? "rounded-br-sm bg-gold text-background"
                            : "rounded-bl-sm bg-surface-2 text-foreground"
                        }`
                  }
                >
                  {m.type === "text" ? (
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  ) : (
                    <>
                      <ChatAttachment message={m} isMine={isMine} />
                      {m.body && (
                        <div
                          className={`whitespace-pre-wrap break-words text-sm ${
                            isBareMedia
                              ? `px-3.5 py-2 ${isMine ? "bg-gold text-background" : "bg-surface-2 text-foreground"}`
                              : "mt-1.5"
                          }`}
                        >
                          {m.body}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                  {formatBubbleTime(m.created_at)}
                  {isMine &&
                    (readByOthers ? (
                      <CheckCheck className="h-3 w-3 text-gold" />
                    ) : (
                      <Check className="h-3 w-3" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        draft={draft}
        onDraftChange={handleDraftChange}
        onSendText={handleSend}
        onSendFile={handleSendFile}
        sending={send.isPending || sendAttachment.isPending}
      />

      {showInfo && (
        <ChatInfoPanel
          conversation={conversation}
          projectId={projectId}
          myUserId={myId}
          isGlobalAdmin={isGlobalAdmin}
          onClose={() => setShowInfo(false)}
          onLeft={() => {
            setShowInfo(false);
            onBack?.();
          }}
        />
      )}
    </div>
  );
}
