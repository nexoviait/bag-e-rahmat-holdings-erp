<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Throwable;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            if ($user->hasAnyRole(['super_admin', 'admin'])) {
                $projects = Project::orderBy('created_at', 'desc')->get();
            } else {
                $assignedIds = $user->projects()->pluck('projects.id')->toArray();
                $shProjectIds = \App\Models\Shareholder::where('user_id', $user->id)->pluck('project_id')->toArray();
                $allIds = array_unique(array_merge($assignedIds, $shProjectIds));

                $projects = Project::whereIn('id', $allIds)->orderBy('created_at', 'desc')->get();
            }

            return response()->json($projects);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to fetch projects list.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'code' => ['nullable', 'string', 'max:50'],
                'description' => ['nullable', 'string'],
                'status' => ['required', 'in:planning,active,on_hold,completed,cancelled'],
                'total_shareholder_project_price' => ['nullable', 'numeric', 'min:0'],
                'total_shareholders' => ['nullable', 'integer', 'min:0'],
                'start_date' => ['nullable', 'date'],
                'end_date' => ['nullable', 'date'],
            ]);

            $project = Project::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            $request->user()->projects()->attach($project->id);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
                'action' => "Created project {$project->name}",
                'entity' => 'Project',
                'entity_id' => (string)$project->id,
            ]);

            return response()->json($project, 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to create project. Please verify input fields.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            $project = Project::findOrFail($id);

            if (!$user->hasAnyRole(['super_admin', 'admin']) && !$user->projects->contains($id)) {
                return response()->json(['message' => 'Access denied to this project.'], 403);
            }

            return response()->json($project);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to retrieve project details.'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $project = Project::findOrFail($id);

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'code' => ['nullable', 'string', 'max:50'],
                'description' => ['nullable', 'string'],
                'status' => ['required', 'in:planning,active,on_hold,completed,cancelled'],
                'total_shareholder_project_price' => ['nullable', 'numeric', 'min:0'],
                'total_shareholders' => ['nullable', 'integer', 'min:0'],
                'start_date' => ['nullable', 'date'],
                'end_date' => ['nullable', 'date'],
            ]);

            $project->update($validated);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
                'action' => "Updated project details",
                'entity' => 'Project',
                'entity_id' => (string)$project->id,
            ]);

            return response()->json($project);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update project.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $project = Project::findOrFail($id);
            $name = $project->name;
            $project->delete();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => "Deleted project {$name}",
                'entity' => 'Project',
                'entity_id' => (string)$id,
            ]);

            return response()->json(['message' => 'Project deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete project.'], 500);
        }
    }
}
