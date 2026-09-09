<?php

namespace App\Modules\SiteTracking\Policies;

use App\Models\Material;
use App\Models\User;
use App\Modules\SiteTracking\Support\SiteTrackingPermission;

/**
 * Materials/labor aren't restricted per-record like camera feeds are (see
 * DvrDevicePolicy) — just project-membership + a flat permission check.
 * Gate::before in AppServiceProvider bypasses every method here for
 * super_admin; the explicit hasAnyRole() check exists for 'admin', which has
 * no automatic bypass and must actually hold the permission.
 */
class MaterialPolicy
{
    /** $projectId passed the same way as create() — see its docblock. */
    public function viewAny(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(SiteTrackingPermission::MATERIALS_VIEW)) {
            return false;
        }

        if ($projectId === null || $user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function view(User $user, Material $material): bool
    {
        if (!$user->can(SiteTrackingPermission::MATERIALS_VIEW)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($material->project_id);
    }

    /**
     * $projectId is passed via `$this->authorize('create', [Material::class, $projectId])`
     * so that, unlike the CCTV module (where devices.create is admin-only),
     * a 'user'-role holder with materials.create can only create materials for
     * a project they're actually assigned to — materials.* is granted broadly
     * (mirrors financials.*), so this check matters here in a way it doesn't there.
     */
    public function create(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(SiteTrackingPermission::MATERIALS_CREATE)) {
            return false;
        }

        if ($projectId === null || $user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function update(User $user, Material $material): bool
    {
        if (!$user->can(SiteTrackingPermission::MATERIALS_EDIT)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($material->project_id);
    }

    public function delete(User $user, Material $material): bool
    {
        if (!$user->can(SiteTrackingPermission::MATERIALS_DELETE)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($material->project_id);
    }
}
