// Mirrors the JSON shapes of App\Modules\Chat\Http\Resources\* exactly —
// keep these in sync with ConversationResource/MessageResource/
// ConversationParticipantResource if those change.

export type ChatMember = {
  id: number;
  name: string;
  email: string;
  avatar_path: string | null;
  last_seen_at: string | null;
};

export type ConversationParticipant = {
  user_id: number;
  name: string | null;
  email: string | null;
  avatar_path: string | null;
  last_seen_at: string | null;
  role: "admin" | "member";
  muted: boolean;
  joined_at: string | null;
  left_at: string | null;
  last_read_message_id: number | null;
  last_read_at: string | null;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender: { id: number; name: string; avatar_path: string | null } | null;
  type: "text" | "image" | "video" | "file" | "voice_note" | "system";
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  attachment_duration_ms: number | null;
  reply_to_message_id: number | null;
  created_at: string;
};

export type Conversation = {
  id: number;
  project_id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_path: string | null;
  direct_key: string | null;
  participants: ConversationParticipant[] | null;
  latest_message: ChatMessage | null;
  my_last_read_message_id: number | null;
  unread_count: number | null;
  created_at: string;
  updated_at: string;
};

export type CallParticipantInfo = {
  user_id: number;
  name: string | null;
  avatar_path: string | null;
  status: "ringing" | "joined" | "declined" | "left" | "missed";
  joined_at: string | null;
  left_at: string | null;
};

export type Call = {
  id: number;
  project_id: number;
  conversation_id: number;
  type: "audio" | "video";
  status: "ringing" | "ongoing" | "ended" | "missed" | "declined";
  initiated_by: number | null;
  initiator: { id: number; name: string; avatar_path: string | null } | null;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  participants: CallParticipantInfo[] | null;
  created_at: string;
};
