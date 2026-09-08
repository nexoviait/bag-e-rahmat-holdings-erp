<?php

namespace App\Modules\Cctv\Repositories;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\DTO\CameraChannelData;
use App\Modules\Cctv\DTO\CameraFilterData;
use App\Modules\Cctv\DTO\SyncResultData;
use App\Modules\Cctv\Support\StreamPathNamer;
use Illuminate\Database\Eloquent\Collection;

final class EloquentCameraChannelRepository implements CameraChannelRepositoryInterface
{
    public function findWithDeviceOrFail(int $id): CameraChannel
    {
        return CameraChannel::with(['device', 'device.project'])->findOrFail($id);
    }

    public function listVisibleTo(User $user, CameraFilterData $filter): Collection
    {
        $query = CameraChannel::query()
            ->with(['device:id,project_id,device_name,status,is_active,visibility', 'device.project:id,name,code']);

        if ($filter->deviceId) {
            $query->where('dvr_device_id', $filter->deviceId);
        }
        if ($filter->status) {
            $query->where('status', $filter->status);
        }
        if ($filter->activeOnly) {
            $query->where('is_active', true);
        }
        if ($filter->projectId) {
            $query->whereHas('device', fn ($d) => $d->where('project_id', $filter->projectId));
        }
        if ($filter->search) {
            // Escape LIKE wildcards so a search for "%" or "_" can't widen the match
            // beyond what the user actually typed.
            $term = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $filter->search) . '%';
            $query->where(function ($w) use ($term) {
                $w->where('camera_name', 'like', $term)->orWhere('location', 'like', $term);
            });
        }

        $this->applyVisibilityScope($query, $user);

        return $query->orderBy('dvr_device_id')->orderBy('channel_number')->get();
    }

    public function statusCountsFor(User $user): array
    {
        $query = CameraChannel::query()->where('is_active', true);
        $this->applyVisibilityScope($query, $user);

        $counts = (clone $query)
            ->selectRaw('status, count(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        return [
            'online' => (int) ($counts[CameraChannel::STATUS_ONLINE] ?? 0),
            'offline' => (int) ($counts[CameraChannel::STATUS_OFFLINE] ?? 0),
            'unknown' => (int) ($counts[CameraChannel::STATUS_UNKNOWN] ?? 0),
            'total' => (int) $counts->sum(),
        ];
    }

    public function update(CameraChannel $camera, CameraChannelData $data): CameraChannel
    {
        $camera->update($data->toModelAttributes());

        return $camera->fresh(['device']);
    }

    public function markStatus(CameraChannel $camera, string $status): CameraChannel
    {
        $camera->update([
            'status' => $status,
            'last_seen_at' => $status === CameraChannel::STATUS_ONLINE ? now() : $camera->last_seen_at,
        ]);

        return $camera;
    }

    public function markAllOfflineForDevice(DvrDevice $device): void
    {
        CameraChannel::where('dvr_device_id', $device->id)
            ->where('is_active', true)
            ->where('status', '!=', CameraChannel::STATUS_OFFLINE)
            ->update(['status' => CameraChannel::STATUS_OFFLINE]);
    }

    public function upsertFromSync(DvrDevice $device, array $discovered): SyncResultData
    {
        $created = 0;
        $updated = 0;
        $discoveredNumbers = array_map(fn ($d) => $d->channelNumber, $discovered);

        foreach ($discovered as $d) {
            $existing = CameraChannel::where('dvr_device_id', $device->id)
                ->where('channel_number', $d->channelNumber)
                ->first();

            if ($existing) {
                $changed = $existing->camera_name !== $d->name || !$existing->is_active;
                $existing->update([
                    'camera_name' => $d->name,
                    'is_active' => true,
                ]);
                if ($changed) {
                    $updated++;
                }
            } else {
                CameraChannel::create([
                    'dvr_device_id' => $device->id,
                    'channel_number' => $d->channelNumber,
                    'camera_name' => $d->name,
                    'stream_path' => StreamPathNamer::forChannel($device->id, $d->channelNumber),
                    'stream_subtype' => CameraChannel::QUALITY_SUB,
                    'status' => CameraChannel::STATUS_UNKNOWN,
                    'is_active' => true,
                ]);
                $created++;
            }
        }

        // Channels the device no longer reports are deactivated, not deleted —
        // preserves their camera_logs history and any existing per-user assignments.
        $deactivated = CameraChannel::where('dvr_device_id', $device->id)
            ->whereNotIn('channel_number', $discoveredNumbers)
            ->where('is_active', true)
            ->update(['is_active' => false]);

        return new SyncResultData(created: $created, updated: $updated, deactivated: $deactivated);
    }

    /**
     * The single authoritative visibility resolution, applied to any query builder
     * over camera_channels. Gate::before(super_admin => true) short-circuits
     * Policy/Gate checks but has NO effect on this raw query — admins/super-admins
     * must be branched around explicitly or they'd see an empty list.
     */
    private function applyVisibilityScope($query, User $user): void
    {
        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return;
        }

        $projectIds = $user->projects()->pluck('projects.id');

        $query->whereHas('device', function ($d) use ($projectIds) {
            $d->where('is_active', true)->whereIn('project_id', $projectIds);
        })->where(function ($w) use ($user) {
            $w->whereHas('device', fn ($d) => $d->where('visibility', DvrDevice::VISIBILITY_ALL))
                ->orWhere(function ($specific) use ($user) {
                    $specific->whereHas('device', fn ($d) => $d->where('visibility', DvrDevice::VISIBILITY_SPECIFIC))
                        ->whereHas('viewers', fn ($v) => $v->where('users.id', $user->id));
                });
        });
    }
}
