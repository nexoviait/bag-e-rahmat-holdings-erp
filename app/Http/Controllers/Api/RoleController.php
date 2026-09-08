<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Throwable;

class RoleController extends Controller
{
    public function index()
    {
        try {
            $roles = Role::with('permissions')->get()->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'permissions' => $role->permissions->pluck('name')->toArray(),
                    'is_system' => in_array($role->name, ['super_admin', 'admin', 'manager', 'user']),
                ];
            });

            return response()->json($roles);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load roles list.'], 500);
        }
    }

    public function permissions()
    {
        try {
            $permissions = Permission::all()->pluck('name')->toArray();
            return response()->json($permissions);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load system permissions.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255', 'unique:roles,name'],
                'permissions' => ['nullable', 'array'],
                'permissions.*' => ['string', 'exists:permissions,name'],
            ]);

            $role = Role::create([
                'name' => strtolower(str_replace(' ', '_', trim($validated['name']))),
                'guard_name' => 'web',
            ]);

            if (!empty($validated['permissions'])) {
                $role->syncPermissions($validated['permissions']);
            }

            return response()->json([
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions()->pluck('name')->toArray(),
                'is_system' => false,
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to create role.'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $role = Role::findOrFail($id);

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255', 'unique:roles,name,' . $id],
                'permissions' => ['nullable', 'array'],
                'permissions.*' => ['string', 'exists:permissions,name'],
            ]);

            // Protect super_admin role name
            if ($role->name === 'super_admin' && $validated['name'] !== 'super_admin') {
                return response()->json(['message' => 'The Super Admin role name cannot be altered.'], 403);
            }

            $role->name = strtolower(str_replace(' ', '_', trim($validated['name'])));
            $role->save();

            if (isset($validated['permissions'])) {
                $role->syncPermissions($validated['permissions']);
            }

            return response()->json([
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions()->pluck('name')->toArray(),
                'is_system' => in_array($role->name, ['super_admin', 'admin', 'manager', 'user']),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Role not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update role.'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $role = Role::findOrFail($id);

            if (in_array($role->name, ['super_admin', 'admin', 'manager', 'user'])) {
                return response()->json(['message' => 'System default roles cannot be deleted.'], 403);
            }

            $role->delete();

            return response()->json(['message' => 'Role deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Role not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete role.'], 500);
        }
    }

    public function togglePermission(Request $request)
    {
        try {
            $validated = $request->validate([
                'role_id' => ['required', 'exists:roles,id'],
                'permission' => ['required', 'string', 'exists:permissions,name'],
                'on' => ['required', 'boolean'],
            ]);

            $role = Role::findOrFail($validated['role_id']);

            if ($validated['on']) {
                $role->givePermissionTo($validated['permission']);
            } else {
                $role->revokePermissionTo($validated['permission']);
            }

            return response()->json([
                'message' => 'Permission updated successfully',
                'permissions' => $role->permissions()->pluck('name')->toArray(),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update role permission.'], 500);
        }
    }
}
