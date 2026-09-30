<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Nominee;
use App\Models\ProjectAssignment;
use App\Models\Shareholder;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * A nominee is a shareholder's chosen representative — they get their own
 * login (created here, immediately) but the account stays `is_active =
 * false` (see AuthController::login's block) until super_admin approves it.
 * Approval also grants them a ProjectAssignment for the shareholder's
 * project, so from that point on they see it exactly like any other
 * project member with the 'nominee' role's (view-only) permissions — no
 * special-cased visibility logic needed anywhere else in the app.
 */
class NomineeController extends Controller
{
    private const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
    private const MAX_FILE_KB = 20480;

    /**
     * The shareholder's own share value — (their effective ownership %, or
     * share_count / project.total_shareholders) × the project's total
     * shareholder price. Same formula ShareholdersTab.tsx/OverviewTab.tsx use
     * client-side; computed here too so every nominee listing (this
     * controller's index, and NomineesPage.tsx's admin-wide view) can show a
     * nominee's own slice of it without each screen re-deriving it.
     */
    private function shareholderSharePrice(?Shareholder $shareholder): float
    {
        if (!$shareholder || !$shareholder->project) {
            return 0.0;
        }

        $budget = (float) ($shareholder->project->total_shareholder_project_price ?? 0);
        if ($budget <= 0) {
            return 0.0;
        }

        $totalShares = (int) ($shareholder->project->total_shareholders ?? 0);
        if ($shareholder->share_type === 'share_count' && $totalShares > 0) {
            return ($shareholder->effective_share_count / $totalShares) * $budget;
        }

        return ($shareholder->effective_ownership_pct / 100) * $budget;
    }

    private function present(Nominee $n): array
    {
        $shareholderSharePrice = $this->shareholderSharePrice($n->shareholder);

        return [
            'id' => $n->id,
            'shareholder_id' => $n->shareholder_id,
            'shareholder_name' => $n->shareholder?->name,
            'project_id' => $n->shareholder?->project_id,
            'project_name' => $n->shareholder?->project?->name,
            'name' => $n->user?->name,
            'email' => $n->user?->email,
            'phone' => $n->user?->phone,
            'is_active' => (bool) $n->user?->is_active,
            'ownership_percentage' => $n->ownership_percentage,
            'shareholder_share_price' => round($shareholderSharePrice, 2),
            'share_price' => round($shareholderSharePrice * ($n->ownership_percentage / 100), 2),
            'nid_name' => $n->nid_name,
            'photo_name' => $n->photo_name,
            'status' => $n->status,
            'approved_by' => $n->approver?->name,
            'approved_at' => $n->approved_at,
            'created_by' => $n->creator?->name,
            'created_by_id' => $n->created_by,
            'created_at' => $n->created_at,
        ];
    }

    public function index(Request $request)
    {
        try {
            $request->validate(['shareholder_id' => 'nullable|exists:shareholders,id']);
            $user = $request->user();

            if ($request->filled('shareholder_id')) {
                $shareholder = Shareholder::findOrFail($request->shareholder_id);

                if (!$user->canAccessProject($shareholder->project_id)) {
                    return response()->json(['message' => 'You do not have access to this project.'], 403);
                }
                if (!$user->can('nominees.view')) {
                    return response()->json(['message' => 'Your role does not have permission to view nominees.'], 403);
                }

                $nominees = Nominee::where('shareholder_id', $shareholder->id)
                    ->with(['shareholder.project', 'user', 'approver', 'creator'])
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn ($n) => $this->present($n));

                return response()->json($nominees);
            }

            // No shareholder filter = the admin-wide management list — only
            // super_admin/admin get to see every nominee across every project.
            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                return response()->json(['message' => 'You do not have permission to view all nominees.'], 403);
            }

            $nominees = Nominee::with(['shareholder.project', 'user', 'approver', 'creator'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn ($n) => $this->present($n));

            return response()->json($nominees);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder not found.'], 404);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load nominees.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->can('nominees.create')) {
                return response()->json(['message' => 'Your role does not have permission to add nominees.'], 403);
            }

            $shareholder = Shareholder::findOrFail($request->input('shareholder_id'));
            if (!$user->canAccessProject($shareholder->project_id)) {
                return response()->json(['message' => 'You do not have access to this project.'], 403);
            }

            $validated = $request->validate([
                'shareholder_id' => 'required|exists:shareholders,id',
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email',
                'password' => 'required|string|min:6',
                'phone' => 'nullable|string|max:50',
                'ownership_percentage' => 'required|numeric|min:0.01|max:100',
                'nid' => 'required|file|max:' . self::MAX_FILE_KB,
                'photo' => 'required|file|max:' . self::MAX_FILE_KB,
            ]);

            // A shareholder can have several nominees (e.g. splitting their
            // stake between heirs), but together they can't claim more than
            // the shareholder's own 100% — same capacity-check reasoning as
            // ShareholderController::store()'s total_shareholders cap.
            $alreadyAllocated = (float) Nominee::where('shareholder_id', $shareholder->id)->sum('ownership_percentage');
            $available = round(100 - $alreadyAllocated, 2);
            if ($validated['ownership_percentage'] > ($available + 0.01)) {
                throw ValidationException::withMessages([
                    'ownership_percentage' => [
                        "Only {$available}% of \"{$shareholder->name}\"'s equity is left to nominate (already {$alreadyAllocated}% allocated to other nominees).",
                    ],
                ]);
            }

            foreach (['nid' => 'nid', 'photo' => 'photo'] as $field => $label) {
                $ext = strtolower($request->file($field)->getClientOriginalExtension());
                if (!in_array($ext, self::DOC_EXTENSIONS, true)) {
                    throw ValidationException::withMessages([
                        $field => ["Unsupported file type for {$label}. Allowed: " . implode(', ', self::DOC_EXTENSIONS) . '.'],
                    ]);
                }
            }

            $nomineeUser = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'phone' => $validated['phone'] ?? null,
                // Blocked from logging in (AuthController::login) until an
                // admin approves — this is the actual access gate, not just a
                // cosmetic status field.
                'is_active' => false,
            ]);
            $nomineeUser->assignRole('nominee');

            $nidFile = $request->file('nid');
            $nidPath = $nidFile->storeAs("nominees/{$shareholder->id}", Str::uuid() . '.' . $nidFile->getClientOriginalExtension(), 'local');

            $photoFile = $request->file('photo');
            $photoPath = $photoFile->storeAs("nominees/{$shareholder->id}", Str::uuid() . '.' . $photoFile->getClientOriginalExtension(), 'local');

            $nominee = Nominee::create([
                'shareholder_id' => $shareholder->id,
                'user_id' => $nomineeUser->id,
                'ownership_percentage' => $validated['ownership_percentage'],
                'nid_path' => $nidPath,
                'nid_name' => $nidFile->getClientOriginalName(),
                'nid_mime' => $nidFile->getClientMimeType(),
                'photo_path' => $photoPath,
                'photo_name' => $photoFile->getClientOriginalName(),
                'photo_mime' => $photoFile->getClientMimeType(),
                'status' => 'pending',
                'created_by' => $user->id,
            ]);
            $nominee->load(['shareholder.project', 'user', 'creator']);

            ActivityLog::create([
                'project_id' => $shareholder->project_id,
                'user_id' => $user->id,
                'action' => "Nominated \"{$nomineeUser->name}\" for shareholder \"{$shareholder->name}\" — pending Super Admin approval",
                'entity' => 'Nominee',
                'entity_id' => (string) $nominee->id,
            ]);

            return response()->json($this->present($nominee), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to add nominee.'], 500);
        }
    }

    public function approve(Request $request, $id)
    {
        try {
            if (!$request->user()->can('nominees.approve')) {
                return response()->json(['message' => 'Only Super Admin can approve nominees.'], 403);
            }

            $nominee = Nominee::with(['shareholder', 'user'])->findOrFail($id);

            $nominee->update([
                'status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);
            $nominee->user->update(['is_active' => true]);

            ProjectAssignment::firstOrCreate([
                'project_id' => $nominee->shareholder->project_id,
                'user_id' => $nominee->user_id,
            ]);

            ActivityLog::create([
                'project_id' => $nominee->shareholder->project_id,
                'user_id' => $request->user()->id,
                'action' => "Approved nominee \"{$nominee->user->name}\" for shareholder \"{$nominee->shareholder->name}\"",
                'entity' => 'Nominee',
                'entity_id' => (string) $nominee->id,
            ]);

            $nominee->load(['shareholder.project', 'user', 'approver', 'creator']);

            return response()->json($this->present($nominee));
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Nominee not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to approve nominee.'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $nominee = Nominee::with(['shareholder', 'user'])->findOrFail($id);
            $user = $request->user();

            // Super Admin can edit any nominee; otherwise only the person who
            // originally submitted it can fix their own entry (name/ownership
            // typos, a wrong email, etc.) — not some other user's nomination.
            if (!$user->can('nominees.edit') && (int) $nominee->created_by !== (int) $user->id) {
                return response()->json(['message' => 'You can only edit nominees you submitted yourself.'], 403);
            }

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email,' . $nominee->user_id,
                'phone' => 'nullable|string|max:50',
                'ownership_percentage' => 'required|numeric|min:0.01|max:100',
            ]);

            // Same 100%-of-the-shareholder capacity check as store(), excluding
            // this nominee's own current allocation from the "already used" total.
            $alreadyAllocated = (float) Nominee::where('shareholder_id', $nominee->shareholder_id)
                ->where('id', '!=', $nominee->id)
                ->sum('ownership_percentage');
            $available = round(100 - $alreadyAllocated, 2);
            if ($validated['ownership_percentage'] > ($available + 0.01)) {
                throw ValidationException::withMessages([
                    'ownership_percentage' => [
                        "Only {$available}% of \"{$nominee->shareholder->name}\"'s equity is left to nominate (already {$alreadyAllocated}% allocated to other nominees).",
                    ],
                ]);
            }

            $nominee->user->update([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
            ]);
            $nominee->update(['ownership_percentage' => $validated['ownership_percentage']]);

            ActivityLog::create([
                'project_id' => $nominee->shareholder->project_id,
                'user_id' => $request->user()->id,
                'action' => "Updated nominee \"{$nominee->user->name}\"",
                'entity' => 'Nominee',
                'entity_id' => (string) $nominee->id,
            ]);

            $nominee->load(['shareholder.project', 'user', 'approver', 'creator']);

            return response()->json($this->present($nominee));
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Nominee not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update nominee.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $nominee = Nominee::with(['shareholder', 'user'])->findOrFail($id);
            $user = $request->user();

            // Same rule as update(): Super Admin can delete any nominee;
            // otherwise only the original submitter can remove their own entry.
            if (!$user->can('nominees.delete') && (int) $nominee->created_by !== (int) $user->id) {
                return response()->json(['message' => 'You can only delete nominees you submitted yourself.'], 403);
            }

            $name = $nominee->user?->name ?? 'Nominee';
            $projectId = $nominee->shareholder->project_id;

            if (Storage::disk('local')->exists($nominee->nid_path)) {
                Storage::disk('local')->delete($nominee->nid_path);
            }
            if (Storage::disk('local')->exists($nominee->photo_path)) {
                Storage::disk('local')->delete($nominee->photo_path);
            }

            // Deletes the nominee's login account too (cascades to this row and
            // their ProjectAssignment) — removing a nominee means removing
            // their access, not just this record.
            $nominee->user?->delete();
            $nominee->delete();

            ActivityLog::create([
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'action' => "Deleted nominee \"{$name}\"",
                'entity' => 'Nominee',
                'entity_id' => (string) $id,
            ]);

            return response()->json(['message' => 'Nominee deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Nominee not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete nominee.'], 500);
        }
    }

    private function downloadFile(Request $request, $id, string $pathField, string $nameField)
    {
        $nominee = Nominee::with('shareholder')->findOrFail($id);
        $user = $request->user();

        if (!$user->canAccessProject($nominee->shareholder->project_id)) {
            return response()->json(['message' => 'You do not have access to this project.'], 403);
        }
        if (!$user->can('nominees.view')) {
            return response()->json(['message' => 'Your role does not have permission to view nominees.'], 403);
        }

        if (!Storage::disk('local')->exists($nominee->{$pathField})) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return Storage::disk('local')->response($nominee->{$pathField}, $nominee->{$nameField});
    }

    public function nid(Request $request, $id)
    {
        try {
            return $this->downloadFile($request, $id, 'nid_path', 'nid_name');
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Nominee not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load file.'], 500);
        }
    }

    public function photo(Request $request, $id)
    {
        try {
            return $this->downloadFile($request, $id, 'photo_path', 'photo_name');
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Nominee not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load file.'], 500);
        }
    }
}
