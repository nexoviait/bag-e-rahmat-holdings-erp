<?php

namespace App\Modules\Cctv\Services;

use App\Models\ActivityLog;
use App\Models\CameraChannel;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use App\Modules\Cctv\DTO\CameraChannelData;
use App\Modules\Cctv\DTO\CameraFilterData;
use Illuminate\Database\Eloquent\Collection;

final class CameraChannelService
{
    public function __construct(
        private readonly CameraChannelRepositoryInterface $cameras,
        private readonly CameraLogRepositoryInterface $logs,
    ) {}

    public function listVisibleTo(User $user, CameraFilterData $filter): Collection
    {
        return $this->cameras->listVisibleTo($user, $filter);
    }

    public function find(int $id): CameraChannel
    {
        return $this->cameras->findWithDeviceOrFail($id);
    }

    public function statusCountsFor(User $user): array
    {
        return $this->cameras->statusCountsFor($user);
    }

    public function update(CameraChannel $camera, CameraChannelData $data, User $actor): CameraChannel
    {
        $camera = $this->cameras->update($camera, $data);

        ActivityLog::create([
            'project_id' => $camera->device->project_id,
            'user_id' => $actor->id,
            'action' => "Updated camera \"{$camera->camera_name}\"",
            'entity' => 'CameraChannel',
            'entity_id' => (string) $camera->id,
        ]);
        $this->logs->record('camera.updated', camera: $camera, userId: $actor->id);

        return $camera;
    }

    public function logsFor(CameraChannel $camera, int $limit = 50): Collection
    {
        return $this->logs->listForCamera($camera, $limit);
    }
}
