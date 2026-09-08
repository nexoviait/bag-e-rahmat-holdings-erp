<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSIONS = [
        'cctv.view',
        'cctv.devices.view',
        'cctv.devices.create',
        'cctv.devices.edit',
        'cctv.devices.delete',
        // Separated from devices.edit — the only permission that opens a socket to
        // physical hardware (test-connection, view-channels, sync-cameras).
        'cctv.devices.test',
        'cctv.cameras.edit',
        'cctv.snapshot',
        'cctv.logs.view',
        'cctv.assign',
        // Reserved for the future Playback feature (Phase 6) so no second permission
        // migration is needed when it lands. Granted to nobody but admins for now.
        'cctv.playback.view',
    ];

    // Unlike the Documents permissions migration, roles do NOT all get the same set —
    // this module's own role matrix (Manager sees, User sees less) requires per-role lists.
    private const ROLE_PERMISSIONS = [
        'super_admin' => self::PERMISSIONS,
        'admin' => self::PERMISSIONS,
        'manager' => ['cctv.view', 'cctv.devices.view', 'cctv.snapshot', 'cctv.logs.view'],
        'user' => ['cctv.view', 'cctv.snapshot'],
    ];

    public function up(): void
    {
        $now = now();

        // The 'manager' role doesn't exist yet — create it idempotently before
        // attaching any permissions.
        $managerExists = DB::table('roles')->where('name', 'manager')->where('guard_name', 'web')->exists();
        if (!$managerExists) {
            DB::table('roles')->insert([
                'name' => 'manager',
                'guard_name' => 'web',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (self::PERMISSIONS as $name) {
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

        $permissionIds = DB::table('permissions')->whereIn('name', self::PERMISSIONS)->pluck('id', 'name');

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
        $permissionIds = DB::table('permissions')->whereIn('name', self::PERMISSIONS)->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        // The 'manager' role itself is intentionally NOT deleted here — by the time
        // this rolls back, real users or other permissions may already be attached to
        // it, and role deletion is far more destructive than removing permissions.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
