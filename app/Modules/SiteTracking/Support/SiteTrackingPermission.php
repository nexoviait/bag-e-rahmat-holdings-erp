<?php

namespace App\Modules\SiteTracking\Support;

/**
 * Single source of truth for this module's permission name strings. Must stay
 * in sync with database/migrations/2026_09_09_000004_add_site_tracking_permissions.php
 * and database/seeders/DatabaseSeeder.php (permission strings are duplicated by
 * design, not generated — see the seeder's sync warning comment).
 */
final class SiteTrackingPermission
{
    public const MATERIALS_VIEW = 'materials.view';
    public const MATERIALS_CREATE = 'materials.create';
    public const MATERIALS_EDIT = 'materials.edit';
    public const MATERIALS_DELETE = 'materials.delete';

    public const LABOR_VIEW = 'labor.view';
    public const LABOR_CREATE = 'labor.create';
    public const LABOR_EDIT = 'labor.edit';
    public const LABOR_DELETE = 'labor.delete';
}
