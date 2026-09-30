<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\NocRequest;
use App\Models\Project;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * "Apply for Others" — No Objection Certificate requests. Any project
 * member can request one (e.g. for a bank loan or visa); once approved, an
 * admin uploads the actual signed NOC PDF here for the requester to
 * download, rather than handing it over outside the system.
 */
class NocRequestController extends Controller
{
    private const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
    private const MAX_FILE_KB = 20480;

    private function present(NocRequest $r): array
    {
        return [
            'id' => $r->id,
            'project_id' => $r->project_id,
            'project_name' => $r->project?->name,
            'requested_by' => $r->requester?->name,
            'requested_by_id' => $r->requested_by,
            'purpose' => $r->purpose,
            'details' => $r->details,
            'status' => $r->status,
            'admin_notes' => $r->admin_notes,
            'document_name' => $r->document_name,
            'approved_by' => $r->approver?->name,
            'approved_at' => $r->approved_at,
            'created_at' => $r->created_at,
        ];
    }

    public function index(Request $request)
    {
        try {
            $request->validate(['project_id' => 'nullable|exists:projects,id']);
            $user = $request->user();

            if ($request->filled('project_id')) {
                if (!$user->canAccessProject((int) $request->project_id)) {
                    return response()->json(['message' => 'You do not have access to this project.'], 403);
                }
                if (!$user->can('applications.view')) {
                    return response()->json(['message' => 'Your role does not have permission to view requests.'], 403);
                }

                $query = NocRequest::where('project_id', $request->project_id)->with(['project', 'approver', 'requester']);
                if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                    $query->where('requested_by', $user->id);
                }

                return response()->json($query->orderBy('created_at', 'desc')->get()->map(fn ($r) => $this->present($r)));
            }

            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                return response()->json(['message' => 'You do not have permission to view all requests.'], 403);
            }

            $items = NocRequest::with(['project', 'approver', 'requester'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn ($r) => $this->present($r));

            return response()->json($items);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load requests.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->can('applications.create')) {
                return response()->json(['message' => 'Your role does not have permission to submit this request.'], 403);
            }

            $project = Project::findOrFail($request->input('project_id'));
            if (!$user->canAccessProject($project->id)) {
                return response()->json(['message' => 'You do not have access to this project.'], 403);
            }

            $validated = $request->validate([
                'project_id' => 'required|exists:projects,id',
                'purpose' => 'required|string|max:255',
                'details' => 'nullable|string',
            ]);

            $item = NocRequest::create([
                'project_id' => $project->id,
                'requested_by' => $user->id,
                'purpose' => $validated['purpose'],
                'details' => $validated['details'] ?? null,
                'status' => 'pending',
            ]);
            $item->load(['project', 'requester']);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'action' => "Requested NOC — {$validated['purpose']}",
                'entity' => 'NocRequest',
                'entity_id' => (string) $item->id,
            ]);

            return response()->json($this->present($item), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to submit request.'], 500);
        }
    }

    public function approve(Request $request, $id)
    {
        try {
            if (!$request->user()->can('applications.approve')) {
                return response()->json(['message' => 'Only Super Admin can approve NOC requests.'], 403);
            }

            $item = NocRequest::with('project')->findOrFail($id);
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'This request has already been processed.'], 422);
            }

            $validated = $request->validate([
                'admin_notes' => 'nullable|string',
                'document' => 'required|file|max:' . self::MAX_FILE_KB,
            ]);

            $file = $request->file('document');
            $ext = strtolower($file->getClientOriginalExtension());
            if (!in_array($ext, self::DOC_EXTENSIONS, true)) {
                throw ValidationException::withMessages([
                    'document' => ['Unsupported file type. Allowed: ' . implode(', ', self::DOC_EXTENSIONS) . '.'],
                ]);
            }

            $path = $file->storeAs("noc-requests/{$item->id}", Str::uuid() . '.' . $ext, 'local');

            $item->update([
                'status' => 'approved',
                'admin_notes' => $validated['admin_notes'] ?? null,
                'document_path' => $path,
                'document_name' => $file->getClientOriginalName(),
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            ActivityLog::create([
                'project_id' => $item->project_id,
                'user_id' => $request->user()->id,
                'action' => "Approved NOC request — {$item->purpose}",
                'entity' => 'NocRequest',
                'entity_id' => (string) $item->id,
            ]);

            $item->load(['project', 'approver', 'requester']);

            return response()->json($this->present($item));
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to approve request.'], 500);
        }
    }

    public function reject(Request $request, $id)
    {
        try {
            if (!$request->user()->can('applications.approve')) {
                return response()->json(['message' => 'Only Super Admin can reject NOC requests.'], 403);
            }

            $item = NocRequest::findOrFail($id);
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'This request has already been processed.'], 422);
            }

            $validated = $request->validate(['admin_notes' => 'nullable|string']);

            $item->update([
                'status' => 'rejected',
                'admin_notes' => $validated['admin_notes'] ?? null,
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            ActivityLog::create([
                'project_id' => $item->project_id,
                'user_id' => $request->user()->id,
                'action' => "Rejected NOC request — {$item->purpose}",
                'entity' => 'NocRequest',
                'entity_id' => (string) $item->id,
            ]);

            $item->load(['project', 'approver', 'requester']);

            return response()->json($this->present($item));
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to reject request.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $item = NocRequest::findOrFail($id);
            $user = $request->user();

            if (!$user->can('applications.delete') && (int) $item->requested_by !== (int) $user->id) {
                return response()->json(['message' => 'You can only delete requests you submitted yourself.'], 403);
            }

            if ($item->document_path && Storage::disk('local')->exists($item->document_path)) {
                Storage::disk('local')->delete($item->document_path);
            }
            $item->delete();

            return response()->json(['message' => 'Request deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete request.'], 500);
        }
    }

    public function document(Request $request, $id)
    {
        try {
            $item = NocRequest::findOrFail($id);
            $user = $request->user();

            if (!$user->canAccessProject($item->project_id)) {
                return response()->json(['message' => 'You do not have access to this project.'], 403);
            }
            if (!$user->can('applications.view')) {
                return response()->json(['message' => 'Your role does not have permission to view this document.'], 403);
            }
            if (!$user->hasAnyRole(['super_admin', 'admin']) && (int) $item->requested_by !== (int) $user->id) {
                return response()->json(['message' => 'You do not have access to this document.'], 403);
            }

            if (!$item->document_path || !Storage::disk('local')->exists($item->document_path)) {
                return response()->json(['message' => 'Document not found.'], 404);
            }

            return Storage::disk('local')->response($item->document_path, $item->document_name);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load document.'], 500);
        }
    }
}
