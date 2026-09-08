<?php

namespace App\Modules\Cctv\Services;

use App\Models\ActivityLog;
use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\DTO\DeviceProbeResultData;
use App\Modules\Cctv\DTO\DvrDeviceData;
use App\Modules\Cctv\DTO\SyncResultData;
use Illuminate\Database\Eloquent\Collection;

/**
 * Orchestrates device CRUD, connection testing, and channel sync. The one place
 * that decides which mutations are business-visible enough for the shared
 * ActivityLog (device create/update/delete/sync) versus operational-only
 * camera_logs (connection tests) — see the module README's dual-log-write rule.
 */
final class DvrDeviceService
{
    public function __construct(
        private readonly DvrDeviceRepositoryInterface $devices,
        private readonly CameraChannelRepositoryInterface $cameras,
        private readonly CameraLogRepositoryInterface $logs,
        private readonly DvrGatewayInterface $gateway,
    ) {}

    public function listVisibleTo(User $user, ?int $projectId = null): Collection
    {
        return $this->devices->listVisibleTo($user, $projectId);
    }

    public function find(int $id): DvrDevice
    {
        return $this->devices->findOrFail($id);
    }

    public function create(DvrDeviceData $data, User $actor): DvrDevice
    {
        $device = $this->devices->create($data);

        ActivityLog::create([
            'project_id' => $device->project_id,
            'user_id' => $actor->id,
            'action' => "Added DVR device \"{$device->device_name}\"",
            'entity' => 'DvrDevice',
            'entity_id' => (string) $device->id,
        ]);
        $this->logs->record('device.created', device: $device, userId: $actor->id);

        return $device;
    }

    public function update(DvrDevice $device, DvrDeviceData $data, User $actor): DvrDevice
    {
        $device = $this->devices->update($device, $data);

        ActivityLog::create([
            'project_id' => $device->project_id,
            'user_id' => $actor->id,
            'action' => "Updated DVR device \"{$device->device_name}\"",
            'entity' => 'DvrDevice',
            'entity_id' => (string) $device->id,
        ]);
        $this->logs->record('device.updated', device: $device, userId: $actor->id);

        return $device;
    }

    public function delete(DvrDevice $device, User $actor): void
    {
        $name = $device->device_name;
        $projectId = $device->project_id;
        $deviceId = $device->id;

        $this->devices->delete($device);

        ActivityLog::create([
            'project_id' => $projectId,
            'user_id' => $actor->id,
            'action' => "Deleted DVR device \"{$name}\"",
            'entity' => 'DvrDevice',
            'entity_id' => (string) $deviceId,
        ]);
        // No camera_logs entry here — the device row (and its FK) is already gone,
        // and camera_logs.dvr_device_id cascade-deletes with it.
    }

    /**
     * $actor is nullable so the scheduled health-poll command (no logged-in
     * user) can call this too, rather than inventing a synthetic "system" user
     * row that would leak into user lists/pickers elsewhere in the ERP.
     */
    public function testConnection(DvrDevice $device, ?User $actor): DeviceProbeResultData
    {
        $result = $this->gateway->testConnection($device);

        $status = match (true) {
            $result->reachable && $result->authorized => DvrDevice::STATUS_ONLINE,
            $result->reachable && !$result->authorized => DvrDevice::STATUS_UNAUTHORIZED,
            default => DvrDevice::STATUS_OFFLINE,
        };

        $this->devices->updateStatus($device, $status, $result->errorMessage);

        // Connection tests are high-frequency/operational — camera_logs only,
        // not the shared ActivityLog (see module dual-log-write rule).
        $this->logs->record(
            'device.tested',
            device: $device,
            description: $result->errorMessage,
            meta: ['reachable' => $result->reachable, 'authorized' => $result->authorized],
            userId: $actor?->id,
        );

        return $result;
    }

    /**
     * Fetches the device's channel list from the physical DVR (live probe, not
     * the locally-stored camera_channels rows) — used by the "View Channels"
     * action to preview what a sync would do before committing it.
     *
     * @return \App\Modules\Cctv\DTO\DiscoveredChannelData[]
     */
    public function discoverChannels(DvrDevice $device): array
    {
        return $this->gateway->discoverChannels($device);
    }

    public function syncChannels(DvrDevice $device, User $actor): SyncResultData
    {
        $discovered = $this->gateway->discoverChannels($device);
        $result = $this->cameras->upsertFromSync($device, $discovered);

        ActivityLog::create([
            'project_id' => $device->project_id,
            'user_id' => $actor->id,
            'action' => "Synced cameras for \"{$device->device_name}\" "
                . "({$result->created} added, {$result->updated} updated, {$result->deactivated} deactivated)",
            'entity' => 'DvrDevice',
            'entity_id' => (string) $device->id,
        ]);
        $this->logs->record('device.sync', device: $device, meta: $result->toArray(), userId: $actor->id);

        return $result;
    }
}
