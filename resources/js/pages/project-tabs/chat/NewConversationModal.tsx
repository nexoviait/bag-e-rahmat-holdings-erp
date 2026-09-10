import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { X, Users, User, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChatMember, Conversation } from "./types";
import { Avatar } from "./Avatar";

/** Same "escape-hatch" ModalShell shape DailyLogTab.tsx uses for its own modals. */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      {/* max-h + overflow-y-auto — the member picker list already scrolls on
          its own, but the Send/Create button below it can still get pushed
          off a short mobile screen without a cap + scroll on the panel itself. */}
      <div className="noir-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewConversationModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const myUserId = Number(user?.id);
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");

  const members = useQuery({
    queryKey: ["chat", "members", projectId],
    queryFn: async () => (await api.get<ChatMember[]>(`/projects/${projectId}/chat/members`)).data,
  });

  const filtered = useMemo(() => {
    // getMembers() returns every project member INCLUDING the current
    // user — the backend only rejects a self-DM at creation time, it
    // doesn't filter the roster, so this picker has to do it itself.
    const list = (members.data ?? []).filter((m) => m.id !== myUserId);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members.data, myUserId, search]);

  const create = useMutation({
    mutationFn: async () => {
      if (mode === "direct") {
        if (selected.length !== 1) throw new Error("Pick one person to message.");
        const res = await api.post<Conversation>(`/projects/${projectId}/chat/conversations`, {
          type: "direct",
          member_user_ids: selected,
        });
        return res.data;
      }
      if (!groupName.trim()) throw new Error("Give the group a name.");
      if (selected.length < 1) throw new Error("Pick at least one other member.");
      const res = await api.post<Conversation>(`/projects/${projectId}/chat/conversations`, {
        type: "group",
        name: groupName.trim(),
        member_user_ids: selected,
      });
      return res.data;
    },
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
      onCreated(conversation);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to start conversation.");
    },
  });

  function toggle(userId: number) {
    if (mode === "direct") {
      setSelected((s) => (s.includes(userId) ? [] : [userId]));
    } else {
      setSelected((s) => (s.includes(userId) ? s.filter((id) => id !== userId) : [...s, userId]));
    }
  }

  return (
    <ModalShell title="New Conversation" onClose={onClose}>
      <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface-2 p-1">
        <button
          onClick={() => {
            setMode("direct");
            setSelected([]);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition cursor-pointer ${
            mode === "direct" ? "bg-gold text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-3.5 w-3.5" /> Direct Message
        </button>
        <button
          onClick={() => {
            setMode("group");
            setSelected([]);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition cursor-pointer ${
            mode === "group" ? "bg-gold text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Group
        </button>
      </div>

      {mode === "group" && (
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          className="mb-3 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
        />
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project members…"
          className="w-full rounded-md border border-border bg-input py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-gold"
        />
      </div>

      <div className="no-scrollbar mb-4 max-h-64 space-y-1 overflow-y-auto">
        {members.isLoading && (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        )}
        {!members.isLoading && filtered.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">No matching members.</div>
        )}
        {filtered.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${
                isSelected ? "bg-gold/10" : "hover:bg-accent"
              }`}
            >
              <Avatar name={m.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div
                className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                  isSelected ? "border-gold bg-gold" : "border-border"
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => create.mutate()}
        disabled={create.isPending || selected.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "direct" ? "Start Conversation" : "Create Group"}
      </button>
    </ModalShell>
  );
}
