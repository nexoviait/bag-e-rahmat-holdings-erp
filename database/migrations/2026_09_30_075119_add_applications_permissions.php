<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    // 'applications.*' covers the project-scoped "Apply for Others" tab
    // (Share Transfer, Share Sell, NOC) — approving a transfer/sell directly
    // rewrites a Shareholder's ownership_pct/share_count, so (like
    // nominees.approve) that stays super_admin-only even though 'admin'
    // otherwise mirrors super_admin everywhere else. 'job_applications.*' is
    // its own, lower-stakes set — reviewing a CV isn't ownership-changing, so
    // admin gets full control there.
    private const APPLICATION_PERMISSIONS = [
        'applications.view', 'applications.create', 'applications.approve', 'applications.delete',
    ];
    private const JOB_APPLICATION_PERMISSIONS = [
        'job_applications.view', 'job_applications.create', 'job_applications.review', 'job_applications.delete',
    ];

    private const ROLE_PERMISSIONS = [
        'super_admin' => [
            'applications.view', 'applications.create', 'applications.approve', 'applications.delete',
            'job_applications.view', 'job_applications.create', 'job_applications.review', 'job_applications.delete',
        ],
        'admin' => [
            'applications.view', 'applications.create',
            'job_applications.view', 'job_applications.create', 'job_applications.review', 'job_applications.delete',
        ],
        'manager' => [
            'applications.view', 'applications.create',
            'job_applications.view', 'job_applications.create',
        ],
        'user' => [
            'applications.view', 'applications.create',
            'job_applications.view', 'job_applications.create',
        ],
        // Nominees don't request share transfers/sells/NOCs on someone
        // else's behalf, but there's no reason to block them from applying
        // for a job — that's a personal action, unrelated to what they
        // represent.
        'nominee' => [
            'job_applications.view', 'job_applications.create',
        ],
    ];

    public function up(): void
    {
        $now = now();
        $allNames = array_merge(self::APPLICATION_PERMISSIONS, self::JOB_APPLICATION_PERMISSIONS);

        foreach ($allNames as $name) {
            $exists = DB::table('permissions')->where('name', $name)->where('guard_name', 'web')->exists();
            if (!$exists) {
                DB::table('permissions')->insert([
                    'name' => $name,
                    'guard_name' => 'web',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $permissionIds = DB::table('permissions')->whereIn('name', $allNames)->pluck('id', 'name');

        foreach (self::ROLE_PERMISSIONS as $roleName => $permissionNames) {
            $role = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->first();
            if (!$role) {
                continue;
            }

            foreach ($permissionNames as $permissionName) {
                $permissionId = $permissionIds[$permissionName] ?? null;
                if (!$permissionId) {
                    continue;
                }

                $alreadyAssigned = DB::table('role_has_permissions')
                    ->where('role_id', $role->id)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if (!$alreadyAssigned) {
                    DB::table('role_has_permissions')->insert([
                        'permission_id' => $permissionId,
                        'role_id' => $role->id,
                    ]);
                }
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $allNames = array_merge(self::APPLICATION_PERMISSIONS, self::JOB_APPLICATION_PERMISSIONS);
        $permissionIds = DB::table('permissions')->whereIn('name', $allNames)->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
