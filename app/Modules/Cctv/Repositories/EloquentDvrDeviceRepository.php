<?php

namespace App\Modules\Cctv\Repositories;

use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use App\Modules\Cctv\DTO\DvrDeviceData;
use Illuminate\Database\Eloquent\Collection;

final class EloquentDvrDeviceRepository implements DvrDeviceRepositoryInterface
{
    public function findOrFail(int $id): DvrDevice
    {
        return DvrDevice::with('project')->findOrFail($id);
    }

    public function listVisibleTo(User $user, ?int $projectId = null): Collection
    {
        $query = DvrDevice::query()->with('project:id,name,code');

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        // Same visibility gate as cameras (see EloquentCameraChannelRepository) —
        // applied here first, at the device level, since 'admin_only'/'specific'
        // devices should not even be listed for a non-admin, not just have their
        // individual cameras filtered.
        if (!$user->hasAnyRole(['super_admin', 'admin'])) {
            $projectIds = $user->projects()->pluck('projects.id');

            $query->where('is_active', true)
                ->whereIn('project_id', $projectIds)
                ->where(function ($w) use ($user) {
                    $w->where('visibility', DvrDevice::VISIBILITY_ALL)
                        ->orWhere(function ($specific) use ($user) {
                            $specific->where('visibility', DvrDevice::VISIBILITY_SPECIFIC)
                                ->whereHas('channels.viewers', fn ($v) => $v->where('users.id', $user->id));
                        });
                });
        }

        return $query->orderBy('device_name')->get();
    }

    public function create(DvrDeviceData $data): DvrDevice
    {
        // 'status' is set explicitly rather than relying on the DB column default —
        // Eloquent's in-memory model after create() doesn't know about a DB-applied
        // default for a column it never set, so the API response would otherwise
        // show status: null even though the persisted row correctly has 'unknown'.
        return DvrDevice::create([
            ...$data->toModelAttributes(),
            'status' => DvrDevice::STATUS_UNKNOWN,
        ]);
    }

    public function update(DvrDevice $device, DvrDeviceData $data): DvrDevice
    {
        $device->update($data->toModelAttributes());

        return $device->fresh(['project']);
    }

    public function delete(DvrDevice $device): void
    {
        $device->delete();
    }

    public function updateStatus(DvrDevice $device, string $status, ?string $error = null): DvrDevice
    {
        $device->update([
            'status' => $status,
            'last_error' => $error,
            'last_seen_at' => $status === DvrDevice::STATUS_ONLINE ? now() : $device->last_seen_at,
        ]);

        return $device;
    }

    public function projectMemberIds(DvrDevice $device): array
    {
        return $device->project->users()->pluck('users.id')->all();
    }
}
