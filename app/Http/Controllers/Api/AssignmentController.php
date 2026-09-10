<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Project;
use App\Models\ProjectAssignment;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class AssignmentController extends Controller
{
    public function index(Request $request)
    {
        try {
            $users = User::orderBy('name')->get()->map(fn($u) => [
                'id' => $u->id,
                'full_name' => $u->name,
                'email' => $u->email,
            ]);

            $projects = Project::orderBy('name')->get()->map(fn($p) => [
                'id' => $p->id,
                'name' => $p->name,
            ]);

            $assigns = ProjectAssignment::all()->map(fn($a) => [
                'user_id' => $a->user_id,
                'project_id' => $a->project_id,
            ]);

            return response()->json([
                'users' => $users,
                'projects' => $projects,
                'assigns' => $assigns,
            ]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load assignment matrix.'], 500);
        }
    }

    public function toggle(Request $request)
    {
        try {
            $validated = $request->validate([
                'user_id' => ['required', 'exists:users,id'],
                'project_id' => ['required', 'exists:projects,id'],
                'on' => ['required', 'boolean'],
            ]);

            if ($validated['on']) {
                ProjectAssignment::firstOrCreate([
                    'user_id' => $validated['user_id'],
                    'project_id' => $validated['project_id'],
                ]);
            } else {
                // Deliberately ->get()->each->delete() rather than a single
                // bulk ->delete() — a mass query-builder delete never fires
                // Eloquent's per-model `deleted` event, which is what
                // ChatServiceProvider listens on to soft-leave the user from
                // this project's conversations the moment they're unassigned.
                ProjectAssignment::where('user_id', $validated['user_id'])
                    ->where('project_id', $validated['project_id'])
                    ->get()
                    ->each(fn (ProjectAssignment $assignment) => $assignment->delete());
            }

            return response()->json(['message' => 'Project assignment updated successfully']);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update project assignment.'], 500);
        }
    }
}
