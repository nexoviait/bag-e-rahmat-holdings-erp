<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\AppSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 0. System App Settings
        $defaultSettings = [
            'app_name' => 'Nexovia',
            'app_subtitle' => 'Holdings ERP',
            'app_logo' => null,
            'app_favicon' => null,
        ];
        foreach ($defaultSettings as $k => $v) {
            AppSetting::firstOrCreate(['key' => $k], ['value' => $v]);
        }

        // 1. Create System Permissions
        $permissions = [
            'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
            'financials.view', 'financials.create', 'financials.edit', 'financials.delete',
            'shareholders.view', 'shareholders.manage',
            'documents.view', 'documents.create', 'documents.edit', 'documents.delete',
            'users.manage',
            'reports.view',
            'cctv.view', 'cctv.devices.view', 'cctv.devices.create', 'cctv.devices.edit',
            'cctv.devices.delete', 'cctv.devices.test', 'cctv.cameras.edit', 'cctv.snapshot',
            'cctv.logs.view', 'cctv.assign', 'cctv.playback.view',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        // 2. Create Core System Roles
        // NOTE: syncPermissions() REPLACES a role's entire permission set — every
        // permission that role should have must be listed here, even ones granted
        // to it elsewhere (e.g. by a migration), or re-running this seeder silently
        // strips them back out.
        $roleMap = [
            'super_admin' => $permissions,
            'admin' => $permissions,
            'manager' => [
                'cctv.view', 'cctv.devices.view', 'cctv.snapshot', 'cctv.logs.view',
            ],
            'user' => [
                'projects.view', 'projects.create', 'projects.edit',
                'financials.view', 'financials.create', 'financials.edit',
                'shareholders.view', 'reports.view',
                'documents.view', 'documents.create', 'documents.edit', 'documents.delete',
                'cctv.view', 'cctv.snapshot',
            ],
        ];

        foreach ($roleMap as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($perms);
        }

        // 3. Create Default Accounts
        $superAdmin = User::create([
            'name' => 'System Administrator',
            'email' => 'admin@brahmatholdings.com',
            'password' => Hash::make('12345678'),
            'phone' => '+8801700000001',
            'is_active' => true,
        ]);
        $superAdmin->assignRole('super_admin');

        $adminUser = User::create([
            'name' => 'Manager Admin',
            'email' => 'manager@brahmatholdings.com',
            'password' => Hash::make('12345678'),
            'phone' => '+8801700000002',
            'is_active' => true,
        ]);
        $adminUser->assignRole('admin');

        $standardUser = User::create([
            'name' => 'MD. Shahjalal',
            'email' => 'shahjalal@brahmatholdings.com',
            'password' => Hash::make('12345678'),
            'phone' => '+8801700000003',
            'is_active' => true,
        ]);
        $standardUser->assignRole('user');
    }
}
