<?php

namespace App\Modules\Cctv\Services;

use App\Models\ActivityLog;
use App\Models\CameraChannel;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraAccessRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use Illuminate\Validation\ValidationException;

/**
 * Manages the camera_user_assignments pivot — the "specific users" per-camera
 * override consulted when the owning device's visibility mode is 'specific'.
 */
final class CameraAccessService
{
    public function __construct(
        private readonly CameraAccessRepositoryInterface $access,
        private readonly DvrDeviceRepositoryInterface $devices,
        private readonly CameraLogRepositoryInterface $logs,
    ) {}

    public function listAssignedUserIds(CameraChannel $camera): array
    {
        return $this->access->listAssignedUserIds($camera);
    }

    /**
     * @param int[] $userIds
     * @throws ValidationException if any user is not a member of the camera's project
     */
    public function sync(CameraChannel $camera, array $userIds, User $actor): array
    {
        $memberIds = $this->devices->projectMemberIds($camera->device);
        $invalid = array_diff($userIds, $memberIds);

        if (!empty($invalid)) {
            throw ValidationException::withMessages([
                'user_ids' => ['One or more selected users are not members of this camera\'s project.'],
            ]);
        }

        $this->access->sync($camera, $userIds, $actor->id);

        ActivityLog::create([
            'project_id' => $camera->device->project_id,
            'user_id' => $actor->id,
            'action' => "Updated viewer access for camera \"{$camera->camera_name}\"",
            'entity' => 'CameraChannel',
            'entity_id' => (string) $camera->id,
            'meta' => ['assigned_user_ids' => $userIds],
        ]);
        $this->logs->record(
            'access.assigned',
            camera: $camera,
            meta: ['assigned_user_ids' => $userIds],
            userId: $actor->id,
        );

        return $this->access->listAssignedUserIds($camera);
    }
}
