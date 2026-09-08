<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Modules\Cctv\Http\Requests\SyncCameraAccessRequest;
use App\Modules\Cctv\Services\CameraAccessService;
use App\Modules\Cctv\Services\CameraChannelService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class CameraAccessController extends CctvController
{
    public function __construct(
        private readonly CameraChannelService $cameras,
        private readonly CameraAccessService $access,
    ) {}

    public function index(Request $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('manageAccess', $camera);

            $users = $camera->viewers()->get(['users.id', 'users.name', 'users.email']);

            return response()->json($users);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to manage this camera\'s access.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load camera assignments.'], 500);
        }
    }

    /** The pool of users eligible to be assigned to this camera — members of its device's project, excluding admins. */
    public function assignableUsers(Request $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('manageAccess', $camera);

            $users = $camera->device->project->users()
                ->orderBy('name')
                ->get(['users.id', 'users.name', 'users.email'])
                ->filter(fn ($u) => !$u->hasAnyRole(['super_admin', 'admin']))
                ->values();

            return response()->json($users);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to manage this camera\'s access.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load assignable users.'], 500);
        }
    }

    public function sync(SyncCameraAccessRequest $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('manageAccess', $camera);

            $userIds = array_map('intval', $request->validated('user_ids'));
            $this->access->sync($camera, $userIds, $request->user());

            $users = $camera->viewers()->get(['users.id', 'users.name', 'users.email']);

            return response()->json($users);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to manage this camera\'s access.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update camera assignments.'], 500);
        }
    }
}
