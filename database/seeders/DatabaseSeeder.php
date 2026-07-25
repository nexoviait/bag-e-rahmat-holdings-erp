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
            'users.manage',
            'reports.view',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        // 2. Create 3 Core System Roles
        $roleMap = [
            'super_admin' => $permissions,
            'admin' => $permissions,
            'user' => [
                'projects.view', 'projects.create', 'projects.edit',
                'financials.view', 'financials.create', 'financials.edit',
                'shareholders.view', 'reports.view',
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
            'name' => 'MD. Shahjalal Hossain',
            'email' => 'shahjalal@brahmatholdings.com',
            'password' => Hash::make('12345678'),
            'phone' => '+8801700000003',
            'is_active' => true,
        ]);
        $standardUser->assignRole('user');
    }
}
