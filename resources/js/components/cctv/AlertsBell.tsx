import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

type NotificationItem = {
  id: string;
  data: { message: string; device_name?: string; project_name?: string };
  read_at: string | null;
  created_at: string;
};

/**
 * Global — not scoped to the Monitoring page or CctvTab — because an offline
 * alert should be visible regardless of which page the user is currently on.
 * Reads the generic /notifications endpoint; camera-offline alerts are just
 * today's only producer of it.
 */
export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data as { data: NotificationItem[]; unread_count: number },
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications.data?.unread_count ?? 0;
  const items = notifications.data?.data ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Alerts"
        className="relative rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="noir-panel absolute right-0 z-50 mt-2 w-80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Alerts</h4>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium text-gold hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="no-scrollbar max-h-80 space-y-1.5 overflow-y-auto">
              {items.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">No alerts yet.</div>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                  className={`block w-full rounded-md px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                    n.read_at
                      ? "text-muted-foreground hover:bg-accent"
                      : "bg-gold/10 text-foreground hover:bg-gold/15"
                  }`}
                >
                  <div>{n.data.message}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtDate(n.created_at)}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
