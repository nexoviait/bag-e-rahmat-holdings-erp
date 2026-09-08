import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import {
  Bell,
  AlertTriangle,
  WifiOff,
  VideoOff,
  HardDrive,
  Activity,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface EventCenterViewProps {
  projectId?: string;
}

const EVENT_TYPE_CONFIG: Record<
  string,
  { label: string; cls: string; icon: React.ElementType; severity: "high" | "warning" | "info" }
> = {
  "device.offline": { label: "Device Offline", cls: "text-destructive bg-destructive/10 border-destructive/30", icon: WifiOff, severity: "high" },
  "camera.offline": { label: "Camera Offline", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: VideoOff, severity: "warning" },
  "motion.detected": { label: "Motion Detected", cls: "text-gold bg-gold/10 border-gold/30", icon: Activity, severity: "info" },
  "video.loss": { label: "Video Loss", cls: "text-destructive bg-destructive/10 border-destructive/30", icon: VideoOff, severity: "high" },
  "storage.full": { label: "Storage Full", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: HardDrive, severity: "warning" },
  "recording.failure": { label: "Recording Failure", cls: "text-destructive bg-destructive/10 border-destructive/30", icon: AlertTriangle, severity: "high" },
};

export function EventCenterView({ projectId }: EventCenterViewProps) {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["cctv-events", projectId, eventTypeFilter],
    queryFn: async () => {
      let url = `/cctv/events?limit=100`;
      if (projectId) url += `&project_id=${projectId}`;
      if (eventTypeFilter) url += `&event=${eventTypeFilter}`;
      const res = await api.get(url);
      return res.data as any[];
    },
    refetchInterval: 15000,
  });

  function requestBrowserNotifications() {
    if (!("Notification" in window)) {
      toast.error("Browser notifications are not supported in this browser.");
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        toast.success("Browser notifications enabled for CCTV security events!");
      } else {
        toast.error("Browser notification permission denied.");
      }
    });
  }

  const list = (eventsQuery.data ?? []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.event.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.camera_channel?.camera_name && item.camera_channel.camera_name.toLowerCase().includes(q)) ||
      (item.dvr_device?.device_name && item.dvr_device.device_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="noir-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by keyword or device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 text-foreground pl-9 pr-4 py-1.5 text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gold shrink-0" />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-surface-2 text-foreground border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="">All Event Types</option>
              <option value="device.offline">Device Offline</option>
              <option value="camera.offline">Camera Offline</option>
              <option value="motion.detected">Motion Detected</option>
              <option value="video.loss">Video Loss</option>
              <option value="storage.full">Storage Full</option>
              <option value="recording.failure">Recording Failure</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => eventsQuery.refetch()}
            disabled={eventsQuery.isRefetching}
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2/80 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${eventsQuery.isRefetching ? "animate-spin text-gold" : ""}`} /> Refresh
          </button>

          <button
            onClick={requestBrowserNotifications}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/25 transition cursor-pointer"
          >
            <Bell className="h-3.5 w-3.5" /> Enable Web Alerts
          </button>
        </div>
      </div>

      {/* Events List Table */}
      {eventsQuery.isLoading ? (
        <div className="noir-panel p-12 text-center text-muted-foreground flex justify-center items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-gold" /> Loading security events log...
        </div>
      ) : list.length === 0 ? (
        <div className="noir-panel p-16 text-center text-muted-foreground">
          <CheckCircle className="h-12 w-12 text-emerald-500/40 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground">No Security Events Logged</h3>
          <p className="text-sm mt-1">All cameras and recorder devices are operating normally.</p>
        </div>
      ) : (
        <div className="noir-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/60 text-xs font-semibold uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Source Device / Camera</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((evt) => {
                  const cfg = EVENT_TYPE_CONFIG[evt.event] || {
                    label: evt.event,
                    cls: "text-muted-foreground bg-surface-2 border-border",
                    icon: Activity,
                    severity: "info",
                  };
                  const Icon = cfg.icon;

                  return (
                    <tr key={evt.id} className="hover:bg-surface-2/40 transition">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(evt.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {evt.camera_channel
                          ? `Ch.${evt.camera_channel.channel_number} ${evt.camera_channel.camera_name}`
                          : evt.dvr_device
                          ? evt.dvr_device.device_name
                          : "System"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {evt.description || "System log entry"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedEvent(evt)}
                          className="rounded-md p-1 text-muted-foreground hover:text-gold hover:bg-accent transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Details Dialog */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
          <div className="noir-panel w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-lg font-semibold text-foreground">Event Log Details</h3>
              <button onClick={() => setSelectedEvent(null)} className="rounded p-1 hover:bg-accent cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event Code:</span>
                <span className="font-mono font-semibold text-gold">{selectedEvent.event}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Recorded At:</span>
                <span className="font-mono">{fmtDate(selectedEvent.created_at)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Device:</span>
                <span>{selectedEvent.dvr_device?.device_name || "N/A"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Camera:</span>
                <span>{selectedEvent.camera_channel?.camera_name || "N/A"}</span>
              </div>

              <div className="pt-2 border-t border-border/40">
                <span className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Description</span>
                <p className="text-foreground bg-surface-2 p-2.5 rounded text-xs leading-relaxed">
                  {selectedEvent.description || "No extended details provided."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-6 w-full py-2 bg-surface-2 hover:bg-surface-2/80 font-medium rounded text-sm text-foreground transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
