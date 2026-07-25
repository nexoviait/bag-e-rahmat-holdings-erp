<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shareholder;
use App\Models\ShareholderInvestment;
use App\Models\ProjectAssignment;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Throwable;

class ShareholderController extends Controller
{
    public function index(Request $request)
    {
        try {
            $request->validate([
                'project_id' => 'nullable|exists:projects,id',
                'user_id' => 'nullable|exists:users,id',
            ]);
            $user = $request->user();

            if ($request->filled('user_id')) {
                $shareholders = Shareholder::where('user_id', $request->user_id)->with('project')->get();
                return response()->json($shareholders);
            }

            // Purge any super_admin or admin shareholder entries if present
            Shareholder::where('project_id', $request->project_id)
                ->whereHas('user', function ($q) {
                    $q->role(['super_admin', 'admin']);
                })
                ->delete();

            // Auto-sync assigned regular users (role = user) to shareholders table for this project
            $assignments = ProjectAssignment::where('project_id', $request->project_id)
                ->with('user.roles')
                ->get();

            foreach ($assignments as $a) {
                if ($a->user && !$a->user->hasAnyRole(['super_admin', 'admin'])) {
                    Shareholder::firstOrCreate(
                        ['project_id' => $request->project_id, 'user_id' => $a->user_id],
                        [
                            'name' => $a->user->name,
                            'email' => $a->user->email,
                            'phone' => $a->user->phone,
                            'ownership_pct' => 0.00,
                        ]
                    );
                }
            }

            $query = Shareholder::where('project_id', $request->project_id)->with(['user', 'project']);

            // Non-admin / non-superadmin users ONLY see their own shareholder profile data
            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                $query->where('user_id', $user->id);
            }

            $shareholders = $query->orderBy('created_at')->get();

            return response()->json($shareholders);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load shareholders list.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'project_id' => 'required|exists:projects,id',
                'user_id' => 'nullable|exists:users,id',
                'name' => 'required|string|max:255',
                'email' => 'nullable|email|max:255',
                'phone' => 'nullable|string|max:50',
                'share_type' => 'nullable|in:percentage,share_count',
                'ownership_pct' => 'nullable|numeric|min:0|max:100',
                'share_count' => 'nullable|integer|min:0',
                'notes' => 'nullable|string',
            ]);

            if (!empty($validated['user_id'])) {
                $targetUser = \App\Models\User::find($validated['user_id']);
                if ($targetUser && $targetUser->hasAnyRole(['super_admin', 'admin'])) {
                    return response()->json(['message' => 'Super Admin and Admin accounts cannot be assigned as shareholders.'], 422);
                }
            }

            $project = \App\Models\Project::findOrFail($validated['project_id']);
            if ($project->total_shareholders > 0) {
                $requestedShares = ($validated['share_type'] ?? 'percentage') === 'share_count'
                    ? ($validated['share_count'] ?? 0)
                    : (($validated['ownership_pct'] ?? 0) / 100) * $project->total_shareholders;

                $avail = $project->available_share_count;
                if ($requestedShares > ($avail + 0.01)) {
                    return response()->json([
                        'message' => "Project '{$project->name}' has only {$avail} share(s) available out of {$project->total_shareholders} total shares. Cannot allocate {$requestedShares} shares."
                    ], 422);
                }
            }

            $shareholder = Shareholder::create($validated);

            ActivityLog::create([
                'project_id' => $shareholder->project_id,
                'user_id' => $request->user()->id,
                'action' => "Added shareholder {$shareholder->name}",
                'entity' => 'Shareholder',
                'entity_id' => (string)$shareholder->id,
            ]);

            return response()->json($shareholder, 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to save shareholder information.'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $shareholder = Shareholder::findOrFail($id);

            $validated = $request->validate([
                'user_id' => 'nullable|exists:users,id',
                'name' => 'required|string|max:255',
                'email' => 'nullable|email|max:255',
                'phone' => 'nullable|string|max:50',
                'share_type' => 'nullable|in:percentage,share_count',
                'ownership_pct' => 'nullable|numeric|min:0|max:100',
                'share_count' => 'nullable|integer|min:0',
                'notes' => 'nullable|string',
            ]);

            if (!empty($validated['user_id'])) {
                $targetUser = \App\Models\User::find($validated['user_id']);
                if ($targetUser && $targetUser->hasAnyRole(['super_admin', 'admin'])) {
                    return response()->json(['message' => 'Super Admin and Admin accounts cannot be assigned as shareholders.'], 422);
                }
            }

            $shareholder->update($validated);

            ActivityLog::create([
                'project_id' => $shareholder->project_id,
                'user_id' => $request->user()->id,
                'action' => "Updated shareholder {$shareholder->name}",
                'entity' => 'Shareholder',
                'entity_id' => (string)$shareholder->id,
            ]);

            return response()->json($shareholder);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update shareholder details.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $shareholder = Shareholder::findOrFail($id);
            $name = $shareholder->name;
            $projectId = $shareholder->project_id;
            $shareholder->delete();

            ActivityLog::create([
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'action' => "Removed shareholder {$name}",
                'entity' => 'Shareholder',
                'entity_id' => (string)$id,
            ]);

            return response()->json(['message' => 'Shareholder removed successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to remove shareholder.'], 500);
        }
    }

    public function investments(Request $request)
    {
        try {
            $request->validate(['project_id' => 'required|exists:projects,id']);
            $user = $request->user();

            $query = ShareholderInvestment::where('project_id', $request->project_id)->with('shareholder');

            // Non-admin / non-superadmin users ONLY see their own investments
            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                $sh = Shareholder::where('project_id', $request->project_id)
                    ->where('user_id', $user->id)
                    ->first();

                if ($sh) {
                    $query->where('shareholder_id', $sh->id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }

            $investments = $query->orderBy('date', 'desc')->get();

            return response()->json($investments);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load shareholder investments.'], 500);
        }
    }

    public function storeInvestment(Request $request)
    {
        try {
            $validated = $request->validate([
                'project_id' => 'required|exists:projects,id',
                'shareholder_id' => 'required|exists:shareholders,id',
                'amount' => 'required|numeric|min:0',
                'date' => 'required|date',
                'note' => 'nullable|string',
            ]);

            $investment = ShareholderInvestment::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            $sh = Shareholder::find($investment->shareholder_id);

            ActivityLog::create([
                'project_id' => $investment->project_id,
                'user_id' => $request->user()->id,
                'action' => "Logged investment for " . ($sh ? $sh->name : "Shareholder"),
                'entity' => 'Investment',
                'entity_id' => (string)$investment->id,
                'meta' => ['amount' => $investment->amount],
            ]);

            return response()->json($investment, 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to log investment.'], 500);
        }
    }

    public function updateInvestment(Request $request, $id)
    {
        try {
            $investment = ShareholderInvestment::findOrFail($id);

            $validated = $request->validate([
                'amount' => 'required|numeric|min:0',
                'date' => 'required|date',
                'note' => 'nullable|string',
            ]);

            $investment->update($validated);

            $sh = Shareholder::find($investment->shareholder_id);

            ActivityLog::create([
                'project_id' => $investment->project_id,
                'user_id' => $request->user()->id,
                'action' => "Updated investment for " . ($sh ? $sh->name : "Shareholder"),
                'entity' => 'Investment',
                'entity_id' => (string)$investment->id,
                'meta' => ['amount' => $investment->amount],
            ]);

            return response()->json($investment);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Investment record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update investment.'], 500);
        }
    }

    public function destroyInvestment(Request $request, $id)
    {
        try {
            $investment = ShareholderInvestment::findOrFail($id);
            $projectId = $investment->project_id;
            $amount = $investment->amount;
            $investment->delete();

            ActivityLog::create([
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'action' => "Deleted investment",
                'entity' => 'Investment',
                'entity_id' => (string)$id,
                'meta' => ['amount' => $amount],
            ]);

            return response()->json(['message' => 'Investment record deleted']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Investment record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete investment.'], 500);
        }
    }
}
