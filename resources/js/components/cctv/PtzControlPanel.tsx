import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  RotateCw,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";

interface PtzControlPanelProps {
  cameraId: number;
  cameraName: string;
}

export function PtzControlPanel({ cameraId, cameraName }: PtzControlPanelProps) {
  const [speed, setSpeed] = useState<number>(4);
  const [selectedPreset, setSelectedPreset] = useState<number>(1);
  const [isPatrolling, setIsPatrolling] = useState<boolean>(false);

  const ptzMutation = useMutation({
    mutationFn: async ({ action, preset_id }: { action: string; preset_id?: number }) => {
      const res = await api.post(`/cctv/cameras/${cameraId}/ptz`, {
        action,
        speed,
        preset_id,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || `PTZ ${data.action} executed`);
      if (data.action === "patrol_start") setIsPatrolling(true);
      if (data.action === "patrol_stop") setIsPatrolling(false);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || "PTZ command failed");
    },
  });

  function handleCommand(action: string, preset_id?: number) {
    ptzMutation.mutate({ action, preset_id });
  }

  return (
    <div className="noir-panel p-4 w-full max-w-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <h4 className="font-display text-sm font-semibold text-gold">PTZ Controls</h4>
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{cameraName}</span>
      </div>

      {/* Speed Slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>PTZ Speed</span>
          <span className="font-bold text-foreground">{speed}</span>
        </div>
        <input
          type="range"
          min="1"
          max="8"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
        />
      </div>

      {/* Directional D-Pad */}
      <div className="flex flex-col items-center gap-1 my-2">
        <button
          onClick={() => handleCommand("tilt_up")}
          disabled={ptzMutation.isPending}
          className="p-2.5 rounded-lg bg-surface-2 hover:bg-gold/20 hover:text-gold transition active:scale-95 cursor-pointer disabled:opacity-50"
          title="Tilt Up"
        >
          <ChevronUp className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => handleCommand("pan_left")}
            disabled={ptzMutation.isPending}
            className="p-2.5 rounded-lg bg-surface-2 hover:bg-gold/20 hover:text-gold transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Pan Left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="h-6 w-6 grid place-items-center rounded-full bg-gold/10 text-gold text-[10px] font-bold">
            PTZ
          </div>

          <button
            onClick={() => handleCommand("pan_right")}
            disabled={ptzMutation.isPending}
            className="p-2.5 rounded-lg bg-surface-2 hover:bg-gold/20 hover:text-gold transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Pan Right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => handleCommand("tilt_down")}
          disabled={ptzMutation.isPending}
          className="p-2.5 rounded-lg bg-surface-2 hover:bg-gold/20 hover:text-gold transition active:scale-95 cursor-pointer disabled:opacity-50"
          title="Tilt Down"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Zoom & Focus Controls */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground text-center">Zoom</div>
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => handleCommand("zoom_in")}
              className="p-2 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleCommand("zoom_out")}
              className="p-2 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground text-center">Focus</div>
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => handleCommand("focus_near")}
              className="p-2 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Focus Near"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleCommand("focus_far")}
              className="p-2 rounded bg-surface-2 hover:text-gold transition cursor-pointer"
              title="Focus Far"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Presets & Patrol */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bookmark className="h-3.5 w-3.5 text-gold" /> Preset Position
          </span>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(Number(e.target.value))}
            className="bg-surface-2 text-foreground border border-border rounded px-2 py-0.5 text-xs focus:outline-none"
          >
            {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                Preset {num}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleCommand("preset_goto", selectedPreset)}
            className="flex-1 py-1.5 rounded text-xs font-medium bg-gold/15 text-gold hover:bg-gold/20 transition cursor-pointer"
          >
            Goto {selectedPreset}
          </button>
          <button
            onClick={() => handleCommand("preset_set", selectedPreset)}
            className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-2 text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            Set {selectedPreset}
          </button>
        </div>

        <button
          onClick={() => handleCommand(isPatrolling ? "patrol_stop" : "patrol_start")}
          className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            isPatrolling
              ? "bg-destructive/20 text-destructive border border-destructive/30"
              : "bg-surface-2 text-foreground hover:bg-surface-2/80"
          }`}
        >
          <RotateCw className={`h-3.5 w-3.5 ${isPatrolling ? "animate-spin text-destructive" : ""}`} />
          {isPatrolling ? "Stop Auto Patrol" : "Start Auto Patrol"}
        </button>
      </div>
    </div>
  );
}
