<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    // 'properties.view'/'create' — broad, every role (personal action, like
    // job_applications). 'properties.view_all' lets Super Admin + Admin see
    // everyone's property as a card grid. 'properties.approve' stays
    // Super Admin-only — approving a Sell/Development request is a business
    // decision about someone's personal asset, same stakes class as
    // nominees.approve/applications.approve.
    private const PROPERTIES_PERMISSIONS = [
        'properties.view', 'properties.create', 'properties.delete', 'properties.view_all', 'properties.approve',
    ];

    private const ROLE_PERMISSIONS = [
        'super_admin' => [
            'properties.view', 'properties.create', 'properties.delete', 'properties.view_all', 'properties.approve',
        ],
        'admin' => [
            'properties.view', 'properties.create', 'properties.delete', 'properties.view_all',
        ],
        'manager' => [
            'properties.view', 'properties.create',
        ],
        'user' => [
            'properties.view', 'properties.create',
        ],
        'nominee' => [
            'properties.view', 'properties.create',
        ],
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::PROPERTIES_PERMISSIONS as $name) {
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

        $permissionIds = DB::table('permissions')->whereIn('name', self::PROPERTIES_PERMISSIONS)->pluck('id', 'name');

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
        $permissionIds = DB::table('permissions')->whereIn('name', self::PROPERTIES_PERMISSIONS)->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
