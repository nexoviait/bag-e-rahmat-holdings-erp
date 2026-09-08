import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useHasPermission } from "@/lib/session";
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  Camera,
  Router,
  AlertCircle,
  Wifi,
  WifiOff,
  ShieldAlert,
  RefreshCw,
  PlugZap,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { LivePlayerModal } from "@/components/cctv/LivePlayerModal";
import { EventCenterView } from "@/components/cctv/EventCenterView";
import { Activity } from "lucide-react";

type FieldErrors = Record<string, string[]>;

const DEVICE_STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  online: { label: "Online", cls: "text-[color:var(--success)] bg-[color:var(--success)]/10 border-[color:var(--success)]/30", icon: Wifi },
  offline: { label: "Offline", cls: "text-muted-foreground bg-surface-2 border-border", icon: WifiOff },
  unauthorized: { label: "Unauthorized", cls: "text-destructive bg-destructive/10 border-destructive/30", icon: ShieldAlert },
  unknown: { label: "Unknown", cls: "text-muted-foreground bg-surface-2 border-border", icon: AlertCircle },
};

export function StatusBadge({ status }: { status: string }) {
  const s = DEVICE_STATUS[status] ?? DEVICE_STATUS.unknown;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

const VISIBILITY_LABEL: Record<string, string> = {
  admin_only: "Admin only",
  specific: "Specific users",
  all: "Everyone",
};

function CameraTile({
  cam,
  device,
  canAssign,
  onAssign,
  canStream,
  onOpenLive,
}: {
  cam: any;
  device?: { visibility?: string };
  canAssign: boolean;
  onAssign: (cam: any) => void;
  canStream: boolean;
  onOpenLive: (cam: any) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
          <Camera className="h-3.5 w-3.5 shrink-0 text-gold" />
          Ch.{cam.channel_number} {cam.camera_name}
        </div>
        {cam.location && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{cam.location}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canStream && (
          <button
            onClick={() => onOpenLive(cam)}
            title="View live"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
          >
            <PlayCircle className="h-3.5 w-3.5" />
          </button>
        )}
        {canAssign && device?.visibility === "specific" && (
          <button
            onClick={() => onAssign(cam)}
            title="Assign users"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        )}
        <StatusBadge status={cam.status} />
      </div>
    </div>
  );
}

export function CctvTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canView = useHasPermission("cctv.view");
  const canViewDevices = useHasPermission("cctv.devices.view");
  const canCreate = useHasPermission("cctv.devices.create");
  const canEdit = useHasPermission("cctv.devices.edit");
  const canDelete = useHasPermission("cctv.devices.delete");
  const canTest = useHasPermission("cctv.devices.test");
  const canAssign = useHasPermission("cctv.assign");
  const canStream = useHasPermission("cctv.snapshot");

  const [subTab, setSubTab] = useState<"devices" | "events">("devices");
  const [open, setOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [liveCamera, setLiveCamera] = useState<any | null>(null);
  const [assigningCamera, setAssigningCamera] = useState<any | null>(null);

  const devices = useQuery({
    queryKey: ["cctv-devices", projectId],
    enabled: canViewDevices,
    queryFn: async () => {
      const res = await api.get(`/cctv/devices?project_id=${projectId}`);
      return res.data as any[];
    },
  });

  const cameras = useQuery({
    queryKey: ["cctv-cameras", projectId],
    enabled: canView,
    queryFn: async () => {
      const res = await api.get(`/cctv/cameras?project_id=${projectId}`);
      return res.data as any[];
    },
  });

  const del = useMutation({
    mutationFn: async (device: any) => {
      await api.delete(`/cctv/devices/${device.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cctv-devices", projectId] });
      qc.invalidateQueries({ queryKey: ["cctv-cameras", projectId] });
      toast.success("Device deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const test = useMutation({
    mutationFn: async (device: any) => {
      const res = await api.post(`/cctv/devices/${device.id}/test`);
      return res.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["cctv-devices", projectId] });
      if (result.reachable && result.authorized) {
        toast.success("Connection successful");
      } else {
        toast.error(result.message || "Connection failed");
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const sync = useMutation({
    mutationFn: async (device: any) => {
      const res = await api.post(`/cctv/devices/${device.id}/sync`);
      return res.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["cctv-cameras", projectId] });
      const hasChanges = result.created > 0 || result.updated > 0 || result.deactivated > 0;
      if (!hasChanges) {
        toast.success("Device channels are fully up to date");
      } else {
        toast.success(`Synced: ${result.created} added, ${result.updated} updated, ${result.deactivated} deactivated`);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  function camerasFor(deviceId: number) {
    return (cameras.data ?? []).filter((c) => c.device?.id === deviceId);
  }

  const list = devices.data ?? [];

  if (!canView) {
    return (
      <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
        Your role does not have permission to view CCTV monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border/60 gap-4 text-sm font-semibold mb-4">
        <button
          onClick={() => setSubTab("devices")}
          className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition cursor-pointer ${
            subTab === "devices" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" /> Device & Camera Setup
        </button>
        <button
          onClick={() => setSubTab("events")}
          className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition cursor-pointer ${
            subTab === "events" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" /> Events Log
        </button>
      </div>

      {subTab === "events" && <EventCenterView projectId={projectId} />}

      {subTab === "devices" && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold">CCTV Devices</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canViewDevices
                  ? `DVR/NVR recorders and cameras for this project · ${list.length} ${list.length === 1 ? "device" : "devices"} · ${(cameras.data ?? []).length} cameras`
                  : `Cameras you have access to for this project · ${(cameras.data ?? []).length} cameras`}
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => {
                  setEditingDevice(null);
                  setOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-gold transition hover:opacity-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add device
              </button>
            )}
          </div>

      {!canViewDevices && cameras.isLoading && (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">Loading…</div>
      )}

      {!canViewDevices && !cameras.isLoading && (cameras.data ?? []).length === 0 && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No cameras have been assigned to you for this project yet.
        </div>
      )}

      {!canViewDevices && !cameras.isLoading && (cameras.data ?? []).length > 0 && (
        <div className="space-y-4">
          {Object.entries(
            (cameras.data ?? []).reduce<Record<string, { name: string; cams: any[] }>>((groups, cam) => {
              const devId = String(cam.device?.id ?? 0);
              if (!groups[devId]) groups[devId] = { name: cam.device?.device_name ?? "Unknown device", cams: [] };
              groups[devId].cams.push(cam);
              return groups;
            }, {})
          ).map(([devId, group]) => (
            <div key={devId} className="noir-panel p-5">
              <h3 className="mb-3 font-display text-base font-semibold">{group.name}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.cams
                  .sort((a, b) => a.channel_number - b.channel_number)
                  .map((cam) => (
                    <CameraTile key={cam.id} cam={cam} canAssign={canAssign} onAssign={setAssigningCamera} canStream={canStream} onOpenLive={setLiveCamera} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canViewDevices && devices.isLoading && (
        <div className="noir-panel px-4 py-10 text-center text-muted-foreground">Loading…</div>
      )}

      {canViewDevices && !devices.isLoading && list.length === 0 && (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">
          No CCTV devices added to this project yet.
        </div>
      )}

      {canViewDevices && list.length > 0 && (
        <div className="space-y-3">
          {list.map((device) => {
            const deviceCameras = camerasFor(device.id);
            const isExpanded = !!expanded[device.id];

            return (
              <div key={device.id} className="noir-panel overflow-hidden">
                <div
                  onClick={() => setExpanded((p) => ({ ...p, [device.id]: !p[device.id] }))}
                  className="flex flex-wrap items-center justify-between gap-3 p-5 cursor-pointer hover:bg-surface-2/40 transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                      <Router className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold truncate">{device.device_name}</h3>
                        <StatusBadge status={device.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {device.brand} {device.model} · {device.ip_address}:{device.http_port} ·{" "}
                        {deviceCameras.length} camera{deviceCameras.length === 1 ? "" : "s"} ·{" "}
                        {VISIBILITY_LABEL[device.visibility] ?? device.visibility}
                      </div>
                      {device.last_error && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {device.last_error}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canTest && (
                      <>
                        <button
                          onClick={() => test.mutate(device)}
                          disabled={test.isPending}
                          title="Test connection"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer disabled:opacity-50"
                        >
                          {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => sync.mutate(device)}
                          disabled={sync.isPending}
                          title="Sync cameras from device"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer disabled:opacity-50"
                        >
                          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      </>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingDevice(device);
                          setOpen(true);
                        }}
                        title="Edit device"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-gold cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => confirm(`Delete "${device.device_name}"? This also removes its cameras.`) && del.mutate(device)}
                        title="Delete device"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="ml-1 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/60 bg-surface-1/40 p-5">
                    {deviceCameras.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No cameras yet.{" "}
                        {canTest && "Click the sync icon above to pull channels from this device."}
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {deviceCameras
                          .sort((a, b) => a.channel_number - b.channel_number)
                          .map((cam) => (
                            <CameraTile key={cam.id} cam={cam} device={device} canAssign={canAssign} onAssign={setAssigningCamera} canStream={canStream} onOpenLive={setLiveCamera} />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {open && (
        <DeviceDialog
          projectId={projectId}
          initialData={editingDevice}
          onClose={() => {
            setOpen(false);
            setEditingDevice(null);
          }}
        />
      )}

      {assigningCamera && (
        <CameraAssignDialog
          camera={assigningCamera}
          onClose={() => setAssigningCamera(null)}
        />
      )}

      {liveCamera && (
        <LivePlayerModal camera={liveCamera} onClose={() => setLiveCamera(null)} />
      )}
    </div>
  );
}

function DeviceDialog({
  projectId,
  initialData,
  onClose,
}: {
  projectId: string;
  initialData?: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEditing = !!initialData;

  const [deviceName, setDeviceName] = useState(initialData?.device_name ?? "");
  const [model, setModel] = useState(initialData?.model ?? "DH-XVR1B16H-I");
  const [ipAddress, setIpAddress] = useState(initialData?.ip_address ?? "");
  const [httpPort, setHttpPort] = useState(String(initialData?.http_port ?? 80));
  const [rtspPort, setRtspPort] = useState(String(initialData?.rtsp_port ?? 554));
  const [username, setUsername] = useState(initialData?.username ?? "admin");
  const [password, setPassword] = useState("");
  const [channelCount, setChannelCount] = useState(String(initialData?.channel_count ?? 16));
  const [visibility, setVisibility] = useState<"admin_only" | "specific" | "all">(initialData?.visibility ?? "all");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!deviceName.trim()) errors.device_name = ["Device name is required."];
    if (!ipAddress.trim()) errors.ip_address = ["IP address is required."];
    if (!username.trim()) errors.username = ["Username is required."];
    if (!isEditing && !password.trim()) errors.password = ["Password is required."];
    return errors;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        project_id: Number(projectId),
        device_name: deviceName,
        model: model || null,
        ip_address: ipAddress,
        http_port: Number(httpPort) || 80,
        rtsp_port: Number(rtspPort) || 554,
        username,
        channel_count: Number(channelCount) || 16,
        visibility,
      };
      if (password) payload.password = password;

      if (isEditing) {
        await api.put(`/cctv/devices/${initialData.id}`, payload);
      } else {
        await api.post("/cctv/devices", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cctv-devices", projectId] });
      toast.success(isEditing ? "Device updated" : "Device added");
      onClose();
    },
    onError: (e: any) => {
      const errors = e.response?.data?.errors as FieldErrors | undefined;
      if (errors) setFieldErrors(errors);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">{isEditing ? "Edit device" : "Add CCTV device"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors = validate();
            if (Object.keys(errors).length > 0) {
              setFieldErrors(errors);
              return;
            }
            setFieldErrors({});
            save.mutate();
          }}
          className="space-y-4"
        >
          <Fld label="Device name" error={fieldErrors.device_name?.[0]}>
            <input className="pi" placeholder="e.g. Main Recorder" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
          </Fld>

          <Fld label="Model">
            <input className="pi" placeholder="DH-XVR1B16H-I" value={model} onChange={(e) => setModel(e.target.value)} />
          </Fld>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="IP / Domain / DDNS / P2P ID" error={fieldErrors.ip_address?.[0]}>
              <input className="pi" placeholder="192.168.1.108 or cctv.domain.com" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
            </Fld>
            <Fld label="Channels">
              <input type="number" min="1" max="64" className="pi" value={channelCount} onChange={(e) => setChannelCount(e.target.value)} />
            </Fld>
          </div>
          <div className="-mt-2 mb-2 text-[11px] text-muted-foreground">
            Supports Local IP (192.168.x.x), Public IP, DDNS/Domain Name (cctv.company.com), or Cloud P2P Serial.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="HTTP port">
              <input type="number" className="pi" value={httpPort} onChange={(e) => setHttpPort(e.target.value)} />
            </Fld>
            <Fld label="RTSP port">
              <input type="number" className="pi" value={rtspPort} onChange={(e) => setRtspPort(e.target.value)} />
            </Fld>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Username" error={fieldErrors.username?.[0]}>
              <input className="pi" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Fld>
            <Fld label={isEditing ? "Password (leave blank to keep)" : "Password"} error={fieldErrors.password?.[0]}>
              <input type="password" className="pi" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Fld>
          </div>

          <Fld label="Who can see this device's cameras?">
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["admin_only", "specific", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-1.5 text-xs font-medium transition cursor-pointer ${
                    visibility === v ? "bg-gold text-slate-950 font-bold" : "bg-surface-1 text-muted-foreground"
                  }`}
                >
                  {VISIBILITY_LABEL[v]}
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {visibility === "specific"
                ? "After saving, open each camera's \"Assign users\" button to choose who can see it."
                : visibility === "all"
                ? "Every project member will be able to see this device's cameras."
                : "Only admins will be able to see this device's cameras."}
            </div>
          </Fld>

          <button
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Update device" : "Add device"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CameraAssignDialog({ camera, onClose }: { camera: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  const assignable = useQuery({
    queryKey: ["cctv-camera-assignable-users", camera.id],
    queryFn: async () => {
      const res = await api.get(`/cctv/cameras/${camera.id}/assignable-users`);
      return res.data as { id: number; name: string; email: string }[];
    },
  });

  const current = useQuery({
    queryKey: ["cctv-camera-assignments", camera.id],
    queryFn: async () => {
      const res = await api.get(`/cctv/cameras/${camera.id}/assignments`);
      return res.data as { id: number; name: string; email: string }[];
    },
  });

  useEffect(() => {
    if (current.data) {
      setSelected(current.data.map((u) => String(u.id)));
    }
  }, [current.data]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const save = useMutation({
    mutationFn: async () => {
      await api.post(`/cctv/cameras/${camera.id}/assignments`, {
        user_ids: selected.map(Number),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cctv-camera-assignments", camera.id] });
      toast.success("Camera access updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const loading = assignable.isLoading || current.isLoading;
  const users = assignable.data ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="noir-panel w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">
            Assign users · Ch.{camera.channel_number} {camera.camera_name}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Only admins and the users checked below will be able to see this camera.
        </p>

        <div className="mt-4">
          {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>}

          {!loading && users.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No project members available to assign. Assign users to this project first.
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="no-scrollbar max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2/60 p-2">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-gold"
                    checked={selected.includes(String(u.id))}
                    onChange={() => toggle(String(u.id))}
                  />
                  <span className="min-w-0 truncate text-foreground">{u.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || loading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60 cursor-pointer"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save access
        </button>
      </div>
    </div>
  );
}

function Fld({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}
