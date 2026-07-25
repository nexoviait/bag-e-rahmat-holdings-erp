<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Throwable;

class SettingController extends Controller
{
    public function index()
    {
        try {
            $settings = AppSetting::all()->pluck('value', 'key')->toArray();

            return response()->json([
                'app_name' => $settings['app_name'] ?? 'Bag E Rahmat',
                'app_subtitle' => $settings['app_subtitle'] ?? 'Holdings ERP',
                'app_logo' => $settings['app_logo'] ?? null,
                'app_favicon' => $settings['app_favicon'] ?? null,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'app_name' => 'Bag E Rahmat',
                'app_subtitle' => 'Holdings ERP',
                'app_logo' => null,
                'app_favicon' => null,
            ]);
        }
    }

    public function update(Request $request)
    {
        try {
            $validated = $request->validate([
                'app_name' => ['nullable', 'string', 'max:255'],
                'app_subtitle' => ['nullable', 'string', 'max:255'],
                'logo' => ['nullable', 'file', 'image', 'max:5120'], // max 5MB
                'favicon' => ['nullable', 'file', 'max:2048'], // max 2MB
            ]);

            $uploadDir = public_path('storage/uploads');
            if (!File::exists($uploadDir)) {
                File::makeDirectory($uploadDir, 0777, true, true);
            }

            if (isset($validated['app_name'])) {
                AppSetting::updateOrCreate(['key' => 'app_name'], ['value' => $validated['app_name']]);
            }

            if (isset($validated['app_subtitle'])) {
                AppSetting::updateOrCreate(['key' => 'app_subtitle'], ['value' => $validated['app_subtitle']]);
            }

            if ($request->hasFile('logo')) {
                $file = $request->file('logo');
                $filename = 'logo_' . time() . '.' . $file->getClientOriginalExtension();
                $file->move($uploadDir, $filename);
                $logoUrl = '/storage/uploads/' . $filename;
                AppSetting::updateOrCreate(['key' => 'app_logo'], ['value' => $logoUrl]);
            }

            if ($request->hasFile('favicon')) {
                $file = $request->file('favicon');
                $filename = 'favicon_' . time() . '.' . $file->getClientOriginalExtension();
                $file->move($uploadDir, $filename);
                $faviconUrl = '/storage/uploads/' . $filename;
                AppSetting::updateOrCreate(['key' => 'app_favicon'], ['value' => $faviconUrl]);
            }

            $updated = AppSetting::all()->pluck('value', 'key')->toArray();

            return response()->json([
                'message' => 'System settings updated successfully.',
                'settings' => [
                    'app_name' => $updated['app_name'] ?? 'Bag E Rahmat',
                    'app_subtitle' => $updated['app_subtitle'] ?? 'Holdings ERP',
                    'app_logo' => $updated['app_logo'] ?? null,
                    'app_favicon' => $updated['app_favicon'] ?? null,
                ],
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update settings.'], 500);
        }
    }

    public function activityLogs()
    {
        try {
            $logs = \App\Models\ActivityLog::with('project')->latest()->take(100)->get()->map(function($l) {
                return [
                    'id' => $l->id,
                    'action' => $l->action,
                    'entity' => $l->entity,
                    'created_at' => $l->created_at ? $l->created_at->toIso8601String() : null,
                    'project_name' => $l->project ? $l->project->name : 'System',
                ];
            });
            return response()->json($logs);
        } catch (Throwable $e) {
            return response()->json([]);
        }
    }
}
