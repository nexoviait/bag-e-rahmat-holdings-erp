<?php

namespace App\Modules\SiteTracking\Http\Controllers;

use App\Models\LaborLog;
use App\Modules\SiteTracking\DTO\LaborLogData;
use App\Modules\SiteTracking\Http\Requests\StoreLaborLogRequest;
use App\Modules\SiteTracking\Http\Requests\UpdateLaborLogRequest;
use App\Modules\SiteTracking\Http\Resources\LaborLogResource;
use App\Modules\SiteTracking\Services\LaborLogService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class LaborLogController extends SiteTrackingController
{
    public function __construct(
        private readonly LaborLogService $laborLogs,
    ) {}

    public function index(Request $request)
    {
        try {
            $request->validate([
                'project_id' => 'required|integer|exists:projects,id',
                'date' => 'nullable|date',
            ]);
            $projectId = (int) $request->query('project_id');
            $this->authorize('viewAny', [LaborLog::class, $projectId]);

            $logs = $this->laborLogs->listForProject($projectId, $request->query('date'));

            return response()->json(LaborLogResource::collection($logs));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view labor logs.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load labor logs.'], 500);
        }
    }

    public function store(StoreLaborLogRequest $request)
    {
        try {
            $data = LaborLogData::fromArray($request->validated());
            $this->authorize('create', [LaborLog::class, $data->projectId]);

            $log = $this->laborLogs->create($data, $request->user());

            return response()->json(new LaborLogResource($log), 201);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to record labor logs.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to save labor log.'], 500);
        }
    }

    public function update(UpdateLaborLogRequest $request, $id)
    {
        try {
            $log = $this->laborLogs->find((int) $id);
            $this->authorize('update', $log);

            $data = LaborLogData::fromArray($request->validated());
            $log = $this->laborLogs->update($log, $data, $request->user());

            return response()->json(new LaborLogResource($log));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Labor log not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to edit this labor log.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update labor log.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $log = $this->laborLogs->find((int) $id);
            $this->authorize('delete', $log);

            $this->laborLogs->delete($log, $request->user());

            return response()->json(['message' => 'Labor log deleted successfully']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Labor log not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to delete this labor log.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to delete labor log.'], 500);
        }
    }
}
