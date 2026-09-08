<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Models\CameraChannel;
use App\Modules\Cctv\DTO\CameraChannelData;
use App\Modules\Cctv\DTO\CameraFilterData;
use App\Modules\Cctv\Http\Requests\UpdateCameraRequest;
use App\Modules\Cctv\Http\Resources\CameraChannelResource;
use App\Modules\Cctv\Services\CameraChannelService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class CameraController extends CctvController
{
    public function __construct(
        private readonly CameraChannelService $cameras,
    ) {}

    public function index(Request $request)
    {
        try {
            $this->authorize('viewAny', CameraChannel::class);

            $filter = CameraFilterData::fromArray($request->query());
            $cameras = $this->cameras->listVisibleTo($request->user(), $filter);

            return response()->json(CameraChannelResource::collection($cameras));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view cameras.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load cameras list.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('view', $camera);

            return response()->json(new CameraChannelResource($camera));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'Access denied to this camera.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load camera.'], 500);
        }
    }

    public function update(UpdateCameraRequest $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('update', $camera);

            $data = CameraChannelData::fromArray($request->validated());
            $camera = $this->cameras->update($camera, $data, $request->user());

            return response()->json(new CameraChannelResource($camera));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to edit this camera.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update camera.'], 500);
        }
    }
}
