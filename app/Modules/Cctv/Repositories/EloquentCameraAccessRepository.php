<?php

namespace App\Modules\Cctv\Repositories;

use App\Models\CameraChannel;
use App\Modules\Cctv\Contracts\CameraAccessRepositoryInterface;

final class EloquentCameraAccessRepository implements CameraAccessRepositoryInterface
{
    public function listAssignedUserIds(CameraChannel $camera): array
    {
        return $camera->viewers()->pluck('users.id')->all();
    }

    public function sync(CameraChannel $camera, array $userIds, int $assignedByUserId): void
    {
        $camera->viewers()->sync(
            collect($userIds)->mapWithKeys(fn ($id) => [$id => ['assigned_by' => $assignedByUserId]])->all()
        );
    }
}
