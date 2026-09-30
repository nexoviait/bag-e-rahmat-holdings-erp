<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    // A nominee's account is view-only — they represent a shareholder's
    // stake for record-keeping/inheritance purposes, not to actively manage
    // the project, so unlike the 'user' role they get no create/edit/delete
    // rights anywhere. 'nominees.*' governs the nomination workflow itself
    // (who can submit/approve/manage nominee records), separate from what an
    // approved nominee's own account can see once logged in.
    private const PERMISSIONS = [
        'nominees.view', 'nominees.create', 'nominees.approve', 'nominees.edit', 'nominees.delete',
    ];

    // Unlike every other admin-gated feature in this app (which treats
    // 'admin' as super_admin's equal), the user explicitly asked that ONLY
    // super_admin can approve/edit/delete nominees — approval is what turns a
    // pending record into a real, logged-in account with project access, so
    // it stays a strictly narrower gate than the rest of admin tooling.
    private const ROLE_PERMISSIONS = [
        'super_admin' => self::PERMISSIONS,
        'admin' => ['nominees.view', 'nominees.create'],
        'manager' => ['nominees.view', 'nominees.create'],
        'user' => ['nominees.view', 'nominees.create'],
        'nominee' => ['financials.view', 'shareholders.view', 'documents.view', 'reports.view', 'materials.view', 'labor.view'],
    ];

    public function up(): void
    {
        $now = now();

        // The 'nominee' role doesn't exist yet — create it idempotently
        // before attaching any permissions.
        $nomineeRoleExists = DB::table('roles')->where('name', 'nominee')->where('guard_name', 'web')->exists();
        if (!$nomineeRoleExists) {
            DB::table('roles')->insert([
                'name' => 'nominee',
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

        $allNames = array_unique(array_merge(self::PERMISSIONS, ...array_values(self::ROLE_PERMISSIONS)));
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
        $permissionIds = DB::table('permissions')->whereIn('name', self::PERMISSIONS)->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        // Neither the 'nominee' role, nor the financials.view/etc. permissions it
        // also holds, are deleted here — by rollback time real accounts may
        // already use them, and role/permission deletion is far more
        // destructive than removing just the permissions this migration added.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
