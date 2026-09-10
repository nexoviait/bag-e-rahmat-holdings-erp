import { Loader2, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Conversation, ChatMessage } from "./types";
import { Avatar } from "./Avatar";
import { formatMessageTime } from "./chatTime";

// "You: ..." for your own latest message everywhere; a sender-name prefix
// only in groups (where it disambiguates who said it) — a 1:1 DM's row is
// already labeled with the other person's name, so repeating it in the
// preview ("Amina: How are you?" on a row titled "Amina Akter") is just
// redundant, unlike real WhatsApp's own convention here.
function attachmentPreviewText(message: ChatMessage): string {
  // A captioned attachment shows the caption itself, exactly like every
  // real chat app — the icon+label fallback only covers the caption-less case.
  switch (message.type) {
    case "image":
      return message.body || "📷 Photo";
    case "video":
      return message.body || "🎥 Video";
    case "voice_note":
      return message.body || "🎤 Voice message";
    case "file":
      return message.body || `📄 ${message.attachment_name ?? "File"}`;
    default:
      return message.body ?? "";
  }
}

function messagePreview(conversation: Conversation, message: ChatMessage, myUserId: number): string {
  const body = message.type === "text" ? message.body ?? "" : attachmentPreviewText(message);
  if (message.sender_id === myUserId) return `You: ${body}`;
  if (conversation.type === "group" && message.sender?.name) return `${message.sender.name.split(" ")[0]}: ${body}`;
  return body;
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  onNewConversation,
  onlineUserIds,
  myUserId,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
  onlineUserIds: Set<number>;
  myUserId: number;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <div className="flex h-full w-full flex-col border-r border-border/60 sm:w-72 sm:shrink-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h3 className="font-display text-base font-semibold">Chats</h3>
        <button
          onClick={onNewConversation}
          title="New conversation"
          className="rounded-md bg-gold p-1.5 text-background transition hover:opacity-90 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border/60 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-md border border-border bg-input py-1.5 pl-8 pr-3 text-xs text-foreground outline-none focus:border-gold"
          />
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {isLoading && (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            No conversations yet. Start one with the + button.
          </div>
        )}
        {filtered.map((c) => {
          const otherParticipant =
            c.type === "direct" ? c.participants?.find((p) => p.user_id !== myUserId) : null;
          const isOnline = otherParticipant ? onlineUserIds.has(otherParticipant.user_id) : false;
          const unread = c.unread_count ?? 0;

          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-center gap-3 border-b border-border/30 px-4 py-3 text-left transition cursor-pointer ${
                selectedId === c.id ? "bg-gold/10" : "hover:bg-accent"
              }`}
            >
              {c.type === "group" ? (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                </div>
              ) : (
                <Avatar name={c.name ?? "?"} size={36} online={isOnline} />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.name ?? "Untitled"}</span>
                  {c.latest_message && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatMessageTime(c.latest_message.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.latest_message ? messagePreview(c, c.latest_message, myUserId) : "No messages yet"}
                  </span>
                  {unread > 0 && (
                    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-background">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
