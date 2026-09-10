<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSIONS = [
        'chat.view', 'chat.send', 'chat.groups.create', 'chat.calls.initiate',
    ];

    // Chat is a ubiquitous utility, not gated like CCTV/financials — every
    // role that can be assigned to a project can talk to its other members.
    private const ROLE_PERMISSIONS = [
        'super_admin' => self::PERMISSIONS,
        'admin' => self::PERMISSIONS,
        'manager' => self::PERMISSIONS,
        'user' => self::PERMISSIONS,
    ];

    public function up(): void
    {
        $now = now();

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

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
