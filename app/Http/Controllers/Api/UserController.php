<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Throwable;

class UserController extends Controller
{
    public function index(Request $request)
    {
        try {
            $users = User::orderBy('name')->get()->map(function ($u) {
                return [
                    'id' => $u->id,
                    'full_name' => $u->name,
                    'email' => $u->email,
                    'phone' => $u->phone,
                    'is_active' => $u->is_active,
                    'roles' => $u->getRoleNames()->values()->toArray(),
                ];
            });

            return response()->json($users);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to retrieve user list.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'full_name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'unique:users,email'],
                'password' => ['required', 'string', 'min:6'],
                'role' => ['required', 'string', 'exists:roles,name'],
                'share_allocations' => ['nullable', 'array'],
                'share_allocations.*.project_id' => ['required', 'exists:projects,id'],
                'share_allocations.*.share_type' => ['required', 'in:percentage,share_count'],
                'share_allocations.*.ownership_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'share_allocations.*.share_count' => ['nullable', 'integer', 'min:0'],
            ]);

            // Validate share capacity FIRST before creating user or database changes
            if ($validated['role'] === 'user' && !empty($validated['share_allocations'])) {
                foreach ($validated['share_allocations'] as $alloc) {
                    $project = \App\Models\Project::find($alloc['project_id']);
                    if ($project && $project->total_shareholders > 0) {
                        $avail = $project->available_share_count;
                        $req = $alloc['share_type'] === 'share_count' ? ($alloc['share_count'] ?? 0) : (($alloc['ownership_pct'] ?? 0) / 100) * $project->total_shareholders;
                        if ($req > ($avail + 0.01)) {
                            return response()->json([
                                'message' => "Project '{$project->name}' has only {$avail} share(s) available out of {$project->total_shareholders} total shares."
                            ], 422);
                        }
                    }
                }
            }

            return DB::transaction(function () use ($validated) {
                $user = User::create([
                    'name' => $validated['full_name'],
                    'email' => $validated['email'],
                    'password' => Hash::make($validated['password']),
                    'is_active' => true,
                ]);

                $user->assignRole($validated['role']);

                if ($validated['role'] === 'user' && !empty($validated['share_allocations'])) {
                    foreach ($validated['share_allocations'] as $alloc) {
                        \App\Models\ProjectAssignment::firstOrCreate([
                            'project_id' => $alloc['project_id'],
                            'user_id' => $user->id,
                        ]);

                        \App\Models\Shareholder::create([
                            'project_id' => $alloc['project_id'],
                            'user_id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'phone' => null,
                            'share_type' => $alloc['share_type'],
                            'ownership_pct' => $alloc['share_type'] === 'percentage' ? ($alloc['ownership_pct'] ?? 0) : 0,
                            'share_count' => $alloc['share_type'] === 'share_count' ? ($alloc['share_count'] ?? 0) : 0,
                        ]);
                    }
                }

                return response()->json([
                    'id' => $user->id,
                    'full_name' => $user->name,
                    'email' => $user->email,
                    'is_active' => $user->is_active,
                    'roles' => $user->getRoleNames()->values()->toArray(),
                ], 201);
            });
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to create user account. Please try again.'], 500);
        }
    }

    public function toggleRole(Request $request)
    {
        try {
            $validated = $request->validate([
                'user_id' => ['required', 'exists:users,id'],
                'role' => ['required', 'string', 'exists:roles,name'],
                'on' => ['required', 'boolean'],
            ]);

            $user = User::findOrFail($validated['user_id']);

            // Protect Primary Super Admin account role from being removed
            if ($validated['role'] === 'super_admin' && !$validated['on'] && ($user->email === 'admin@bage-rahmat.com' || $user->id == 1)) {
                return response()->json(['message' => 'Primary Super Admin account permissions cannot be revoked.'], 403);
            }

            if ($validated['on']) {
                $user->assignRole($validated['role']);
            } else {
                $user->removeRole($validated['role']);
            }

            return response()->json(['message' => 'User role updated successfully.', 'roles' => $user->getRoleNames()->values()->toArray()]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Selected user not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update user role.'], 500);
        }
    }

    public function toggleStatus(Request $request)
    {
        try {
            $validated = $request->validate([
                'id' => ['required', 'exists:users,id'],
                'is_active' => ['required', 'boolean'],
            ]);

            $user = User::findOrFail($validated['id']);

            // Protect Primary Super Admin account from being deactivated
            if (($user->email === 'admin@bage-rahmat.com' || $user->id == 1) && !$validated['is_active']) {
                return response()->json(['message' => 'Primary Super Admin account cannot be deactivated.'], 403);
            }

            $user->is_active = $validated['is_active'];
            $user->save();

            return response()->json(['message' => 'User status updated successfully.', 'is_active' => $user->is_active]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Selected user not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update user status.'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            // Protect Primary Super Admin account from being edited/modified
            if ($user->email === 'admin@bage-rahmat.com' || $user->id == 1) {
                return response()->json(['message' => 'Default Super Admin account cannot be modified.'], 403);
            }

            $validated = $request->validate([
                'full_name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'unique:users,email,' . $id],
                'password' => ['nullable', 'string', 'min:6'],
                'share_allocations' => ['nullable', 'array'],
                'share_allocations.*.project_id' => ['required', 'exists:projects,id'],
                'share_allocations.*.share_type' => ['required', 'in:percentage,share_count'],
                'share_allocations.*.ownership_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'share_allocations.*.share_count' => ['nullable', 'integer', 'min:0'],
            ]);

            $user->name = $validated['full_name'];
            $user->email = $validated['email'];

            if (!empty($validated['password'])) {
                $user->password = Hash::make($validated['password']);
            }

            $user->save();

            // Synchronize shareholder allocations if share_allocations provided
            if (isset($validated['share_allocations'])) {
                $newAllocProjectIds = array_column($validated['share_allocations'], 'project_id');
                \App\Models\Shareholder::where('user_id', $user->id)
                    ->whereNotIn('project_id', $newAllocProjectIds)
                    ->delete();

                foreach ($validated['share_allocations'] as $alloc) {
                    \App\Models\ProjectAssignment::firstOrCreate([
                        'project_id' => $alloc['project_id'],
                        'user_id' => $user->id,
                    ]);

                    \App\Models\Shareholder::updateOrCreate(
                        [
                            'project_id' => $alloc['project_id'],
                            'user_id' => $user->id,
                        ],
                        [
                            'name' => $user->name,
                            'email' => $user->email,
                            'share_type' => $alloc['share_type'],
                            'ownership_pct' => $alloc['share_type'] === 'percentage' ? ($alloc['ownership_pct'] ?? 0) : 0,
                            'share_count' => $alloc['share_type'] === 'share_count' ? ($alloc['share_count'] ?? 0) : 0,
                        ]
                    );
                }
            }

            return response()->json([
                'id' => $user->id,
                'full_name' => $user->name,
                'email' => $user->email,
                'is_active' => $user->is_active,
                'roles' => $user->getRoleNames()->values()->toArray(),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Selected user not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update user details.'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $user = User::findOrFail($id);

            // Protect Primary Super Admin account from being deleted
            if ($user->email === 'admin@bage-rahmat.com' || $user->id == 1) {
                return response()->json(['message' => 'Default Super Admin account cannot be deleted.'], 403);
            }

            // Also prevent user from deleting their own currently logged-in account
            if (auth()->id() == $user->id) {
                return response()->json(['message' => 'You cannot delete your own active account.'], 403);
            }

            $user->delete();

            return response()->json(['message' => 'User deleted successfully.']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Selected user not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete user account.'], 500);
        }
    }
}
