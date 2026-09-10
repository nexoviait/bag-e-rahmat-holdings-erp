import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useEcho, usePresenceChannel } from "@laravel/echo-react";
import { Conversation } from "./chat/types";
import { ConversationList } from "./chat/ConversationList";
import { MessageThread } from "./chat/MessageThread";
import { NewConversationModal } from "./chat/NewConversationModal";
import { ChatEmptyState } from "./chat/ChatEmptyState";

export function ChatTab({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const myId = Number(user?.id);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

  const conversationsKey = ["chat", "conversations", projectId] as const;

  const conversationsQuery = useQuery({
    queryKey: conversationsKey,
    queryFn: async () => (await api.get<Conversation[]>(`/projects/${projectId}/chat/conversations`)).data,
    refetchInterval: 30000, // fallback poll — the live path is the WS events below
  });

  const conversations = conversationsQuery.data ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Shared by both the "+" modal and the empty-state's "Online Now" quick-DM
  // shortcut — either path lands on the same "add it to the list, open it" result.
  function handleConversationOpened(conversation: Conversation) {
    qc.setQueryData<Conversation[]>(conversationsKey, (old) => {
      const withoutDup = (old ?? []).filter((c) => c.id !== conversation.id);
      return [conversation, ...withoutDup];
    });
    setSelectedId(conversation.id);
  }

  // A brand-new DM/group someone else started with me appears here live,
  // regardless of whether I'm looking at this project's Chat tab at all —
  // see ConversationCreated's broadcastOn() for why this fires on my
  // personal channel rather than (or in addition to) the conversation's own.
  useEcho(`chat.user.${myId}`, ".conversation.created", (payload: Conversation) => {
    if (payload.project_id !== Number(projectId)) return;
    qc.setQueryData<Conversation[]>(conversationsKey, (old) => {
      if ((old ?? []).some((c) => c.id === payload.id)) return old;
      return [payload, ...(old ?? [])];
    });
  });

  // A message on ANY of this project's conversations — not just the one
  // currently open — needs to refresh this list (unread badge, latest-message
  // preview, re-sort to top). MessageThread's own `.message.sent` listener
  // only fires while that specific conversation's thread is mounted, so
  // without this, every OTHER conversation's sidebar row would only ever
  // catch up via the 30s poll below. MessageSent broadcasts to every
  // recipient's personal channel precisely so this fan-out is possible.
  useEcho(`chat.user.${myId}`, ".message.sent", (payload: { project_id: number }) => {
    if (payload.project_id !== Number(projectId)) return;
    qc.invalidateQueries({ queryKey: conversationsKey });
  });

  // Presence — one subscription per open Chat tab. "here"/"joining"/"leaving"
  // give the live online roster; users.last_seen_at (see UpdateLastSeenAt
  // middleware) covers the fallback once someone's tab is closed.
  const { channel: presenceChannel } = usePresenceChannel(`chat.project.${projectId}`);

  useEffect(() => {
    const ch = presenceChannel();
    if (!ch) return;

    ch.here((members: Array<{ id: number }>) => setOnlineUserIds(new Set(members.map((m) => m.id))));
    ch.joining((member: { id: number }) => setOnlineUserIds((s) => new Set(s).add(member.id)));
    ch.leaving((member: { id: number }) =>
      setOnlineUserIds((s) => {
        const next = new Set(s);
        next.delete(member.id);
        return next;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    // dvh, not vh — vh on mobile Safari/Chrome counts space the address bar
    // covers, clipping the composer at the bottom. Mobile subtracts more
    // than desktop because AppShell adds a 56px top bar below `lg` that
    // desktop's sidebar layout doesn't have (see AppShell.tsx's `mt-14 lg:mt-0`).
    <div className="noir-panel flex h-[calc(100dvh-330px)] min-h-[420px] overflow-hidden sm:h-[calc(100dvh-260px)]">
      {/* w-full is a MOBILE-only claim (nothing selected → the list fills
          the phone screen) — without the sm: sizing matching ConversationList's
          own sm:w-72, this wrapper's un-gated w-full claims 100% flex-basis
          on desktop too, starving whatever sits next to it (the empty state
          below) of any layout space at all regardless of its own flex-1. */}
      <div className={selected ? "hidden sm:flex sm:h-full" : "flex h-full w-full sm:w-72 sm:shrink-0"}>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewConversation={() => setShowNewModal(true)}
          onlineUserIds={onlineUserIds}
          myUserId={myId}
        />
      </div>

      {selected ? (
        <MessageThread
          conversation={selected}
          projectId={projectId}
          onBack={() => setSelectedId(null)}
          onlineUserIds={onlineUserIds}
        />
      ) : (
        <ChatEmptyState
          projectId={projectId}
          conversations={conversations}
          onlineUserIds={onlineUserIds}
          myUserId={myId}
          onNewConversation={() => setShowNewModal(true)}
          onOpenConversation={handleConversationOpened}
        />
      )}

      {showNewModal && (
        <NewConversationModal
          projectId={projectId}
          onClose={() => setShowNewModal(false)}
          onCreated={(conversation) => {
            handleConversationOpened(conversation);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}
