<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Modules\Cctv\Http\Resources\CameraLogResource;
use App\Modules\Cctv\Services\CameraChannelService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class CameraLogController extends CctvController
{
    public function __construct(
        private readonly CameraChannelService $cameras,
    ) {}

    public function index(Request $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('viewLogs', $camera);

            $limit = min(200, max(1, (int) $request->query('limit', 50)));
            $logs = $this->cameras->logsFor($camera, $limit);

            return response()->json(CameraLogResource::collection($logs));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this camera\'s logs.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load camera logs.'], 500);
        }
    }

    public function events(Request $request)
    {
        try {
            $user = $request->user();
            $query = \App\Models\CameraLog::with(['cameraChannel', 'dvrDevice', 'creator'])
                ->orderBy('created_at', 'desc');

            if ($request->filled('project_id')) {
                $projectId = (int) $request->query('project_id');
                $query->whereHas('dvrDevice', function ($q) use ($projectId) {
                    $q->where('project_id', $projectId);
                });
            }

            if ($request->filled('event')) {
                $query->where('event', 'like', '%' . $request->query('event') . '%');
            }

            if ($request->filled('device_id')) {
                $query->where('dvr_device_id', (int) $request->query('device_id'));
            }

            if ($request->filled('camera_id')) {
                $query->where('camera_channel_id', (int) $request->query('camera_id'));
            }

            $limit = min(200, max(1, (int) $request->query('limit', 50)));
            $logs = $query->limit($limit)->get();

            return response()->json(CameraLogResource::collection($logs));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load events: ' . $e->getMessage()], 500);
        }
    }
}
