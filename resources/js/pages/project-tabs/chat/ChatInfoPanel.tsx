import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, Edit2, LogOut, Plus, Shield, UserMinus, Users, X } from "lucide-react";
import { Conversation, ChatMember } from "./types";
import { Avatar } from "./Avatar";
import { formatLastSeen } from "./chatTime";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      {/* max-h + overflow-y-auto — on a short mobile viewport, avatar block +
          rename UI + member list + leave button together can exceed the
          screen height; without this the bottom (often "Leave Group") would
          be clipped with no way to reach it. */}
      <div className="noir-panel flex max-h-[85dvh] w-full max-w-sm flex-col overflow-y-auto p-6">
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

/** Multi-select picker for adding new members to an existing group. */
function AddMembersModal({
  projectId,
  conversation,
  onClose,
  onAdded,
}: {
  projectId: string;
  conversation: Conversation;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const existingIds = new Set((conversation.participants ?? []).map((p) => p.user_id));

  const members = useQuery({
    queryKey: ["chat", "members", projectId],
    queryFn: async () => (await api.get<ChatMember[]>(`/projects/${projectId}/chat/members`)).data,
  });

  const candidates = (members.data ?? []).filter((m) => !existingIds.has(m.id));

  const addMembers = useMutation({
    mutationFn: async () =>
      api.post(`/chat/conversations/${conversation.id}/members`, { member_user_ids: selected }),
    onSuccess: () => {
      toast.success("Members added.");
      onAdded();
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to add members."),
  });

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <ModalShell title="Add Members" onClose={onClose}>
      <div className="no-scrollbar mb-4 max-h-64 space-y-1 overflow-y-auto">
        {candidates.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Everyone on this project is already in the group.
          </div>
        )}
        {candidates.map((m) => {
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
        onClick={() => addMembers.mutate()}
        disabled={selected.length === 0 || addMembers.isPending}
        className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add {selected.length > 0 ? `(${selected.length})` : ""}
      </button>
    </ModalShell>
  );
}

export function ChatInfoPanel({
  conversation,
  projectId,
  myUserId,
  isGlobalAdmin,
  onClose,
  onLeft,
}: {
  conversation: Conversation;
  projectId: string;
  myUserId: number;
  isGlobalAdmin: boolean;
  onClose: () => void;
  onLeft: () => void;
}) {
  const qc = useQueryClient();
  const isGroup = conversation.type === "group";
  const myParticipant = conversation.participants?.find((p) => p.user_id === myUserId);
  // Same rule as the backend's ConversationPolicy::manageMembers — a global
  // admin/super_admin, or this specific group's own admin.
  const canManage = isGroup && (isGlobalAdmin || myParticipant?.role === "admin");

  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(conversation.name ?? "");
  const [showAddMembers, setShowAddMembers] = useState(false);

  function invalidateList() {
    qc.invalidateQueries({ queryKey: ["chat", "conversations", projectId] });
  }

  const rename = useMutation({
    mutationFn: async (name: string) => (await api.put(`/chat/conversations/${conversation.id}`, { name })).data,
    onSuccess: () => {
      invalidateList();
      setRenaming(false);
      toast.success("Group renamed.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to rename group."),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: number) => api.delete(`/chat/conversations/${conversation.id}/members/${userId}`),
    onSuccess: () => {
      invalidateList();
      toast.success("Member removed.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to remove member."),
  });

  const leave = useMutation({
    mutationFn: async () => api.post(`/chat/conversations/${conversation.id}/leave`),
    onSuccess: () => {
      invalidateList();
      onLeft();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to leave group."),
  });

  const activeParticipants = conversation.participants ?? [];

  return (
    <>
      <ModalShell title={isGroup ? "Group Info" : "Contact Info"} onClose={onClose}>
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          {isGroup ? (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-muted-foreground">
              <Users className="h-7 w-7" />
            </div>
          ) : (
            <Avatar name={conversation.name ?? "?"} size={64} />
          )}

          {renaming ? (
            <div className="flex w-full items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                className="flex-1 rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-gold"
              />
              <button
                onClick={() => nameInput.trim() && rename.mutate(nameInput.trim())}
                disabled={rename.isPending}
                className="rounded-md p-1.5 text-gold hover:bg-accent cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setRenaming(false);
                  setNameInput(conversation.name ?? "");
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg font-semibold">{conversation.name ?? "Untitled"}</span>
              {canManage && (
                <button
                  onClick={() => setRenaming(true)}
                  title="Rename group"
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {activeParticipants.length} {activeParticipants.length === 1 ? "Member" : "Members"}
          </h4>
          {canManage && (
            <button
              onClick={() => setShowAddMembers(true)}
              className="flex items-center gap-1 text-xs font-medium text-gold hover:underline cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>

        <div className="no-scrollbar mb-4 max-h-56 space-y-1 overflow-y-auto">
          {activeParticipants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
              <Avatar name={p.name ?? "?"} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {p.user_id === myUserId ? "You" : p.name}
                  </span>
                  {p.role === "admin" && <Shield className="h-3 w-3 shrink-0 text-gold" />}
                </div>
                <div className="truncate text-xs text-muted-foreground">{formatLastSeen(p.last_seen_at)}</div>
              </div>
              {canManage && p.user_id !== myUserId && (
                <button
                  onClick={() => removeMember.mutate(p.user_id)}
                  disabled={removeMember.isPending}
                  title="Remove from group"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {isGroup && (
          <button
            onClick={() => {
              if (confirm("Leave this group? You'll stop receiving its messages.")) leave.mutate();
            }}
            disabled={leave.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Leave Group
          </button>
        )}
      </ModalShell>

      {showAddMembers && (
        <AddMembersModal
          projectId={projectId}
          conversation={conversation}
          onClose={() => setShowAddMembers(false)}
          onAdded={invalidateList}
        />
      )}
    </>
  );
}
