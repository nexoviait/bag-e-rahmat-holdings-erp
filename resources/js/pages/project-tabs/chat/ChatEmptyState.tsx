import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, MessagesSquare, Plus } from "lucide-react";
import { Avatar } from "./Avatar";
import { ChatMember, Conversation } from "./types";

/**
 * The right-pane placeholder shown with no conversation selected — was a
 * static "Select a conversation" label. Now it's an actual jumping-off
 * point: a live snapshot of this chat (conversation/unread counts) plus
 * whoever on the project is online right now, one tap away from a DM,
 * instead of making you go find the + button and pick them from a list.
 */
export function ChatEmptyState({
  projectId,
  conversations,
  onlineUserIds,
  myUserId,
  onNewConversation,
  onOpenConversation,
}: {
  projectId: string;
  conversations: Conversation[];
  onlineUserIds: Set<number>;
  myUserId: number;
  onNewConversation: () => void;
  onOpenConversation: (conversation: Conversation) => void;
}) {
  const members = useQuery({
    queryKey: ["chat", "members", projectId],
    queryFn: async () => (await api.get<ChatMember[]>(`/projects/${projectId}/chat/members`)).data,
  });

  // getMembers() returns every project member INCLUDING the current user
  // (the backend only rejects a self-DM at creation time, it doesn't filter
  // the roster) — exclude myself here since "message yourself" isn't a
  // real option this shortcut should ever offer.
  const onlineMembers = (members.data ?? []).filter((m) => m.id !== myUserId && onlineUserIds.has(m.id));

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const startDirect = useMutation({
    mutationFn: async (userId: number) =>
      (await api.post<Conversation>(`/projects/${projectId}/chat/conversations`, {
        type: "direct",
        member_user_ids: [userId],
      })).data,
    onSuccess: (conversation) => onOpenConversation(conversation),
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to start conversation."),
  });

  return (
    <div className="hidden flex-1 flex-col items-center overflow-y-auto px-6 py-10 sm:flex">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold/10">
        <MessagesSquare className="h-7 w-7 text-gold" />
      </div>

      <h3 className="mt-4 font-display text-lg font-semibold">Project Chat</h3>
      <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
        Select a conversation on the left, or start a new one.
      </p>

      <button
        onClick={onNewConversation}
        className="mt-5 flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 cursor-pointer"
      >
        <Plus className="h-4 w-4" /> New Conversation
      </button>

      {conversations.length > 0 && (
        <div className="mt-6 flex items-center gap-4 rounded-lg border border-border/60 bg-surface-2 px-5 py-3 text-center text-xs">
          <div>
            <div className="font-display text-lg font-semibold">{conversations.length}</div>
            <div className="text-muted-foreground">
              {conversations.length === 1 ? "Conversation" : "Conversations"}
            </div>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div>
            <div className={`font-display text-lg font-semibold ${totalUnread > 0 ? "text-gold" : ""}`}>
              {totalUnread}
            </div>
            <div className="text-muted-foreground">Unread</div>
          </div>
        </div>
      )}

      {onlineMembers.length > 0 && (
        <div className="mt-8 w-full max-w-xs">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online Now
          </h4>
          <div className="space-y-1">
            {onlineMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => startDirect.mutate(m.id)}
                disabled={startDirect.isPending}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <Avatar name={m.name} size={32} online />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                </div>
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
