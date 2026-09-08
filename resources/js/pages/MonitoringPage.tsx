import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { GridVideoTile } from "@/components/cctv/GridVideoTile";
import { LivePlayerModal } from "@/components/cctv/LivePlayerModal";
import { EventCenterView } from "@/components/cctv/EventCenterView";
import {
  Loader2,
  Square,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Activity,
  Video,
} from "lucide-react";

type ViewMode = "live" | "events";

export function MonitoringPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [openCamera, setOpenCamera] = useState<any | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  // 1, 4, 9, 16, 32, 64 — starts smaller on narrow/mobile screens since a
  // 16-tile wall shrinks each tile below ~180px, which isn't enough room for
  // both the camera name and status badge (name gets truncated to nothing
  // useful). Desktop keeps the denser 16-camera default. Still just a
  // starting point — the Grid switcher below lets anyone pick any size.
  const [gridSize, setGridSize] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 4 : 16
  );
  const [currentPage, setCurrentPage] = useState<number>(1);

  const projects = useQuery({
    queryKey: ["cctv-projects"],
    queryFn: async () => (await api.get("/cctv/projects")).data as { id: number; name: string; code: string | null }[],
  });

  const status = useQuery({
    queryKey: ["cctv-status"],
    queryFn: async () => (await api.get("/cctv/status")).data as {
      devices: { total: number; online: number; offline: number; unauthorized: number };
      cameras: { total: number; online: number; offline: number };
    },
    refetchInterval: 30000,
  });

  const cameras = useQuery({
    queryKey: ["cctv-monitoring-cameras", projectId],
    queryFn: async () => {
      const res = await api.get(`/cctv/cameras${projectId ? `?project_id=${projectId}` : ""}`);
      return res.data as any[];
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 60000,
  });

  const allCameras = cameras.data ?? [];
  const totalPages = Math.ceil(allCameras.length / gridSize) || 1;
  const paginatedCameras = allCameras.slice((currentPage - 1) * gridSize, currentPage * gridSize);

  // Dynamic grid CSS mapping based on selected layout size
  const gridCssMap: Record<number, string> = {
    1: "grid-cols-1 max-w-3xl mx-auto",
    4: "grid-cols-1 sm:grid-cols-2",
    9: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    16: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
    32: "grid-cols-2 sm:grid-cols-4 md:grid-cols-6",
    64: "grid-cols-3 sm:grid-cols-6 md:grid-cols-8",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CCTV Enterprise Monitoring"
        title="Cross-Site CCTV Center"
        description="Monitor, replay, and manage live security cameras across all locations globally."
      />

      {/* Summary Stat Widgets — all three are real, live values from /cctv/status.
          There's deliberately no fourth "Storage Usage" card here: nothing in this
          app queries real DVR/disk storage usage, so a hardcoded number used to sit
          here pretending to be real. See PlaybackView's removal for the same reasoning. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Online Devices" value={`${status.data?.devices.online ?? 0} / ${status.data?.devices.total ?? 0}`} accent="green" />
        <StatCard label="Offline Devices" value={String(status.data?.devices.offline ?? 0)} accent={status.data?.devices.offline ? "red" : undefined} />
        <StatCard label="Online Cameras" value={`${status.data?.cameras.online ?? 0} / ${status.data?.cameras.total ?? 0}`} accent="green" />
      </div>

      {/* Top Main Module Navigation Tabs */}
      <div className="flex border-b border-border/60 gap-4 text-sm font-semibold">
        <button
          onClick={() => setViewMode("live")}
          className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition cursor-pointer ${
            viewMode === "live" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Video className="h-4 w-4" /> Live Monitoring
        </button>
        <button
          onClick={() => setViewMode("events")}
          className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition cursor-pointer ${
            viewMode === "events" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" /> Event Center
        </button>
      </div>

      {/* Mode View Content */}
      {viewMode === "events" && <EventCenterView projectId={projectId} />}

      {viewMode === "live" && (
        <div className="space-y-4">
          {/* Controls Bar: Project Filter & Grid Layout Selector */}
          <div className="noir-panel p-4 flex flex-wrap items-center justify-between gap-4">
            {/* Project Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Sites:</span>
              <button
                onClick={() => {
                  setProjectId("");
                  setCurrentPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  projectId === "" ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                }`}
              >
                All Projects
              </button>
              {(projects.data ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProjectId(String(p.id));
                    setCurrentPage(1);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                    projectId === String(p.id) ? "bg-gold text-slate-950 font-bold" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Grid Layout Switcher */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grid:</span>
              <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
                {[
                  { size: 1, label: "1", icon: Square },
                  { size: 4, label: "4", icon: Grid2x2 },
                  { size: 9, label: "9", icon: Grid3x3 },
                  { size: 16, label: "16", icon: LayoutGrid },
                  { size: 32, label: "32", icon: LayoutGrid },
                  { size: 64, label: "64", icon: LayoutGrid },
                ].map((g) => (
                  <button
                    key={g.size}
                    onClick={() => {
                      setGridSize(g.size);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition flex items-center gap-1 cursor-pointer ${
                      gridSize === g.size ? "bg-gold text-slate-950 shadow" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={`${g.size} Camera Grid`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Grid Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded bg-surface-2 hover:text-gold transition cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-mono">
                    Page <strong className="text-foreground">{currentPage}</strong> / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded bg-surface-2 hover:text-gold transition cursor-pointer disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Grid Loading & Empty States */}
          {cameras.isLoading && (
            <div className="noir-panel grid place-items-center px-4 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          )}

          {!cameras.isLoading && allCameras.length === 0 && (
            <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
              No cameras available to you yet.
            </div>
          )}

          {/* Live Camera Grid */}
          {!cameras.isLoading && paginatedCameras.length > 0 && (
            <div className={`grid gap-3 ${gridCssMap[gridSize] || "grid-cols-4"}`}>
              {paginatedCameras.map((cam) => (
                <GridVideoTile key={cam.id} camera={cam} onOpenLive={setOpenCamera} />
              ))}
            </div>
          )}

          {/* Bottom Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 noir-panel text-xs text-muted-foreground">
              <span>
                Showing {paginatedCameras.length} of {allCameras.length} cameras
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="px-1 font-mono text-muted-foreground">
                  <strong className="text-foreground">{currentPage}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-gold/50 hover:text-gold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Player Modal */}
      {openCamera && <LivePlayerModal camera={openCamera} onClose={() => setOpenCamera(null)} />}
    </div>
  );
}
