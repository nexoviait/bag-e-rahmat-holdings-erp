/** "3:45 PM" for today, "Yesterday", or a short date — WhatsApp-style. */
export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Full "HH:MM" for inside a message bubble, regardless of day. */
export function formatBubbleTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Last seen 5m ago" / "Last seen at 3:45 PM" fallback for the presence-less case. */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Offline";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  if (d.toDateString() === new Date().toDateString()) {
    return `Last seen at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Last seen ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
