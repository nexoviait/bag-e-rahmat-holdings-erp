<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSIONS = [
        'documents.view',
        'documents.create',
        'documents.edit',
        'documents.delete',
    ];

    // Assigned to all default roles so existing users keep their current document
    // access out of the box; admins can then narrow this per-role from the
    // Roles & Permissions screen.
    private const DEFAULT_ROLES = ['super_admin', 'admin', 'user'];

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

        $permissionIds = DB::table('permissions')->whereIn('name', self::PERMISSIONS)->pluck('id');
        $roles = DB::table('roles')->whereIn('name', self::DEFAULT_ROLES)->get(['id']);

        foreach ($roles as $role) {
            foreach ($permissionIds as $permissionId) {
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
