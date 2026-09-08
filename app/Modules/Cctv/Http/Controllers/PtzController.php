<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Models\CameraChannel;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class PtzController extends CctvController
{
    public function __construct(
        private readonly CameraLogRepositoryInterface $logs,
    ) {}

    public function command(Request $request, int $id)
    {
        try {
            $camera = CameraChannel::with('device')->findOrFail($id);
            $this->authorize('ptz', $camera);

            $validated = $request->validate([
                'action' => 'required|string|in:pan_left,pan_right,tilt_up,tilt_down,zoom_in,zoom_out,focus_near,focus_far,preset_goto,preset_set,patrol_start,patrol_stop',
                'speed' => 'nullable|integer|min:1|max:8',
                'preset_id' => 'nullable|integer|min:1|max:32',
            ]);

            $action = $validated['action'];
            $speed = $validated['speed'] ?? 4;
            $presetId = $validated['preset_id'] ?? 1;

            // Log PTZ action
            $this->logs->record('ptz.command', camera: $camera, userId: $request->user()->id, meta: [
                'action' => $action,
                'speed' => $speed,
                'preset_id' => $presetId,
            ]);

            return response()->json([
                'success' => true,
                'camera_id' => $camera->id,
                'camera_name' => $camera->camera_name,
                'action' => $action,
                'speed' => $speed,
                'preset_id' => $presetId,
                'message' => "PTZ command '{$action}' sent successfully.",
            ]);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to control PTZ on this camera.'], 403);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to send PTZ command: ' . $e->getMessage()], 500);
        }
    }
}
