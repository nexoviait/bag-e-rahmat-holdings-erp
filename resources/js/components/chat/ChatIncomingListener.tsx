import { useEcho } from "@laravel/echo-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSession } from "@/lib/session";

type IncomingMessage = {
  id: number;
  conversation_id: number;
  project_id: number;
  sender: { id: number; name: string } | null;
  body: string | null;
  type: "text" | "image" | "video" | "file" | "voice_note" | "system";
  attachment_name: string | null;
};

function previewText(payload: IncomingMessage): string {
  switch (payload.type) {
    case "image":
      return payload.body || "📷 Photo";
    case "video":
      return payload.body || "🎥 Video";
    case "voice_note":
      return payload.body || "🎤 Voice message";
    case "file":
      return payload.body || `📄 ${payload.attachment_name ?? "File"}`;
    default:
      return payload.body ?? "";
  }
}

/**
 * Mounted once, globally, in AppShell — same "visible regardless of current
 * page" reasoning AlertsBell already documents for itself. Subscribes to
 * this user's own personal channel (not any one project's) so a message on
 * a project the user isn't currently looking at still surfaces as a toast,
 * with a click-through straight to that project's Chat tab.
 *
 * Deliberately silent while already sitting on that exact project's /chat
 * route — ChatTab's own subscriptions handle live delivery into the open
 * thread there, and a toast on top of an already-visible bubble would just
 * be noise.
 */
export function ChatIncomingListener() {
  const { user } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const myId = Number(user?.id);

  useEcho(`chat.user.${myId}`, ".message.sent", (payload: IncomingMessage) => {
    if (!payload.sender || payload.sender.id === myId) return;

    const onThatProjectsChat = location.pathname === `/projects/${payload.project_id}/chat`;
    if (onThatProjectsChat) return;

    toast.message(payload.sender.name, {
      description: previewText(payload),
      action: {
        label: "Open",
        onClick: () => navigate(`/projects/${payload.project_id}/chat`),
      },
    });
  });

  return null;
}
