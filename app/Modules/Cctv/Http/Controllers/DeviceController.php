<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Models\DvrDevice;
use App\Modules\Cctv\DTO\DvrDeviceData;
use App\Modules\Cctv\Exceptions\CctvException;
use App\Modules\Cctv\Http\Requests\StoreDvrDeviceRequest;
use App\Modules\Cctv\Http\Requests\UpdateDvrDeviceRequest;
use App\Modules\Cctv\Http\Resources\DvrDeviceResource;
use App\Modules\Cctv\Services\DvrDeviceService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class DeviceController extends CctvController
{
    public function __construct(
        private readonly DvrDeviceService $devices,
    ) {}

    public function index(Request $request)
    {
        try {
            $this->authorize('viewAny', DvrDevice::class);

            $projectId = $request->filled('project_id') ? (int) $request->query('project_id') : null;
            $devices = $this->devices->listVisibleTo($request->user(), $projectId);

            return response()->json(DvrDeviceResource::collection($devices));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view CCTV devices.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load devices list.'], 500);
        }
    }

    public function store(StoreDvrDeviceRequest $request)
    {
        try {
            $this->authorize('create', DvrDevice::class);

            $data = DvrDeviceData::fromArray($request->validated());
            $device = $this->devices->create($data, $request->user());
            $device->load('project');

            return response()->json(new DvrDeviceResource($device), 201);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to add CCTV devices.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to create device.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('view', $device);

            return response()->json(new DvrDeviceResource($device));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'Access denied to this device.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load device.'], 500);
        }
    }

    public function update(UpdateDvrDeviceRequest $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('update', $device);

            $data = DvrDeviceData::fromArray($request->validated());
            $device = $this->devices->update($device, $data, $request->user());

            return response()->json(new DvrDeviceResource($device));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to edit this device.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update device.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('delete', $device);

            $this->devices->delete($device, $request->user());

            return response()->json(['message' => 'Device deleted successfully']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to delete this device.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to delete device.'], 500);
        }
    }

    public function test(Request $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('test', $device);

            $result = $this->devices->testConnection($device, $request->user());

            return response()->json([
                'reachable' => $result->reachable,
                'authorized' => $result->authorized,
                'device_type' => $result->deviceType,
                'serial_number' => $result->serialNumber,
                'message' => $result->errorMessage,
                'status' => $device->fresh()->status,
            ]);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to test this device.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to test the connection.'], 500);
        }
    }

    public function channels(Request $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('test', $device);

            $discovered = $this->devices->discoverChannels($device);

            return response()->json(array_map(
                fn ($c) => ['channel_number' => $c->channelNumber, 'name' => $c->name],
                $discovered
            ));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this device\'s channels.'], 403);
        } catch (CctvException $e) {
            return $this->errorResponse($e);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load channels from the device.'], 500);
        }
    }

    public function sync(Request $request, $id)
    {
        try {
            $device = $this->devices->find((int) $id);
            $this->authorize('test', $device);

            $result = $this->devices->syncChannels($device, $request->user());

            return response()->json($result->toArray());
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Device not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to sync this device.'], 403);
        } catch (CctvException $e) {
            return $this->errorResponse($e);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to sync cameras from the device.'], 500);
        }
    }
}
