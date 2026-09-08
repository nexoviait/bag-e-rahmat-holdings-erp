<?php

namespace App\Modules\Cctv\Contracts;

use App\Models\CameraChannel;

interface CameraAccessRepositoryInterface
{
    /** @return int[] user IDs currently assigned to view this camera */
    public function listAssignedUserIds(CameraChannel $camera): array;

    /** @param int[] $userIds */
    public function sync(CameraChannel $camera, array $userIds, int $assignedByUserId): void;
}
