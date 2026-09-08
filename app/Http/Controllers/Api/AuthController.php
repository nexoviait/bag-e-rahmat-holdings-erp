<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        try {
            $credentials = $request->validate([
                'email' => ['required', 'email'],
                'password' => ['required'],
            ]);

            $user = User::where('email', $credentials['email'])->first();

            if (!$user || !Hash::check($credentials['password'], $user->password)) {
                throw ValidationException::withMessages([
                    'email' => ['Invalid email address or password. Please check your credentials.'],
                ]);
            }

            if (!$user->is_active) {
                throw ValidationException::withMessages([
                    'email' => ['This account has been deactivated. Please contact an administrator.'],
                ]);
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'is_active' => $user->is_active,
                    'roles' => $user->getRoleNames()->values()->toArray(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
                ],
                'token' => $token,
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Authentication failed due to a system error. Please try again.',
            ], 500);
        }
    }

    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
                'password' => ['required', 'string', 'min:6'],
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'is_active' => true,
            ]);

            $user->assignRole('user');

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'is_active' => $user->is_active,
                    'roles' => $user->getRoleNames()->values()->toArray(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
                ],
                'token' => $token,
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Registration failed. Please check your input and try again.',
            ], 500);
        }
    }

    public function me(Request $request)
    {
        try {
            $user = $request->user();

            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'is_active' => $user->is_active,
                    'roles' => $user->getRoleNames()->values()->toArray(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Unable to fetch user profile.',
            ], 500);
        }
    }

    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
                'phone' => ['nullable', 'string', 'max:50'],
                'password' => ['nullable', 'string', 'min:6'],
            ]);

            $user->name = $validated['name'];
            $user->email = $validated['email'];
            if (array_key_exists('phone', $validated)) {
                $user->phone = $validated['phone'];
            }
            if (!empty($validated['password'])) {
                $user->password = Hash::make($validated['password']);
            }
            $user->save();

            // Sync updated details to Shareholder entries if linked
            \App\Models\Shareholder::where('user_id', $user->id)->update([
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ]);

            return response()->json([
                'message' => 'Profile updated successfully.',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'is_active' => $user->is_active,
                    'roles' => $user->getRoleNames()->values()->toArray(),
                    'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
                ],
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update profile.'], 500);
        }
    }

    public function logout(Request $request)
    {
        try {
            $request->user()->currentAccessToken()?->delete();

            return response()->json(['message' => 'Logged out successfully']);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Logged out successfully']);
        }
    }
}
