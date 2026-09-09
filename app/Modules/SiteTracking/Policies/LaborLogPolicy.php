<?php

namespace App\Modules\SiteTracking\Policies;

use App\Models\LaborLog;
use App\Models\User;
use App\Modules\SiteTracking\Support\SiteTrackingPermission;

class LaborLogPolicy
{
    /** $projectId passed the same way as create() — see its docblock. */
    public function viewAny(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(SiteTrackingPermission::LABOR_VIEW)) {
            return false;
        }

        if ($projectId === null || $user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function view(User $user, LaborLog $log): bool
    {
        if (!$user->can(SiteTrackingPermission::LABOR_VIEW)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($log->project_id);
    }

    /** See MaterialPolicy::create()'s docblock for why $projectId is checked here. */
    public function create(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(SiteTrackingPermission::LABOR_CREATE)) {
            return false;
        }

        if ($projectId === null || $user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function update(User $user, LaborLog $log): bool
    {
        if (!$user->can(SiteTrackingPermission::LABOR_EDIT)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($log->project_id);
    }

    public function delete(User $user, LaborLog $log): bool
    {
        if (!$user->can(SiteTrackingPermission::LABOR_DELETE)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($log->project_id);
    }
}
