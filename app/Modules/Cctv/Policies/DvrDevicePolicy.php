<?php

namespace App\Modules\Cctv\Policies;

use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Support\CctvPermission;

/**
 * Authorization for a single DvrDevice instance. The coarse "can this role do X
 * to devices at all" question is delegated to Spatie's $user->can() (backed by
 * the cctv.devices.* permissions); this class adds the fine-grained "can THIS
 * user see THIS specific device" project/visibility scoping on top.
 *
 * Gate::before in AppServiceProvider short-circuits every method here to `true`
 * for super_admin before it ever runs — the explicit hasAnyRole() checks below
 * exist for 'admin', which does not get that automatic bypass and must instead
 * rely on actually holding the cctv.* permissions (which the seeded migration
 * grants it).
 */
class DvrDevicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(CctvPermission::DEVICES_VIEW);
    }

    public function view(User $user, DvrDevice $device): bool
    {
        if (!$user->can(CctvPermission::DEVICES_VIEW)) {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

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

        // 'specific' — visible only if the user is assigned to at least one
        // camera on this device.
        return $device->channels()
            ->whereHas('viewers', fn ($v) => $v->where('users.id', $user->id))
            ->exists();
    }

    public function create(User $user): bool
    {
        return $user->can(CctvPermission::DEVICES_CREATE);
    }

    public function update(User $user, DvrDevice $device): bool
    {
        return $user->can(CctvPermission::DEVICES_EDIT);
    }

    public function delete(User $user, DvrDevice $device): bool
    {
        return $user->can(CctvPermission::DEVICES_DELETE);
    }

    /** Test Connection / View Channels / Sync Cameras — the only abilities that open a socket to hardware. */
    public function test(User $user, DvrDevice $device): bool
    {
        return $user->can(CctvPermission::DEVICES_TEST);
    }
}
