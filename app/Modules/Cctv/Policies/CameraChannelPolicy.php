<?php

namespace App\Modules\Cctv\Policies;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Support\CctvPermission;

/**
 * Authorization for a single CameraChannel. Mirrors DvrDevicePolicy's shape and
 * (necessarily) duplicates the visibility algorithm also expressed as a SQL
 * scope in EloquentCameraChannelRepository::applyVisibilityScope() — Eloquent
 * has no clean way to share an in-PHP boolean predicate with a WHERE clause, so
 * the same three-tier rule is intentionally written twice: once here for
 * single-resource checks, once there for list-query scoping. Keep both in sync.
 */
class CameraChannelPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(CctvPermission::VIEW);
    }

    public function view(User $user, CameraChannel $camera): bool
    {
        if (!$user->can(CctvPermission::VIEW)) {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        $device = $camera->device;

        if (!$device->is_active) {
            return false;
        }

        if (!$user->projects->contains($device->project_id)) {
            return false;
        }

        if ($device->visibility === DvrDevice::VISIBILITY_ADMIN_ONLY) {
            return false;
        }

        if ($device->visibility === DvrDevice::VISIBILITY_ALL) {
            return true;
        }

        return $camera->viewers()->where('users.id', $user->id)->exists();
    }

    public function update(User $user, CameraChannel $camera): bool
    {
        return $user->can(CctvPermission::CAMERAS_EDIT);
    }

    public function viewLogs(User $user, CameraChannel $camera): bool
    {
        if (!$user->can(CctvPermission::LOGS_VIEW)) {
            return false;
        }

        // Being allowed to view logs doesn't override camera visibility — you
        // still need to be able to see the camera itself.
        return $this->view($user, $camera);
    }

    public function manageAccess(User $user, CameraChannel $camera): bool
    {
        return $user->can(CctvPermission::ASSIGN);
    }

    /**
     * Live-view / snapshot access — composes the SNAPSHOT permission with the
     * same visibility check as view(), mirroring viewLogs()'s shape. Anyone who
     * can see a camera and holds cctv.snapshot (granted to all 4 roles by
     * default) can stream or snapshot it; no separate visibility algorithm.
     */
    public function stream(User $user, CameraChannel $camera): bool
    {
        if (!$user->can(CctvPermission::SNAPSHOT)) {
            return false;
        }

        return $this->view($user, $camera);
    }

    public function ptz(User $user, CameraChannel $camera): bool
    {
        if (!$user->can(CctvPermission::PTZ) && !$user->hasAnyRole(['super_admin', 'admin'])) {
            return false;
        }

        return $this->view($user, $camera);
    }

}
