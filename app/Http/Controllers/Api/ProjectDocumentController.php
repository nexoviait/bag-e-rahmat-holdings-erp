<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectDocument;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProjectDocumentController extends Controller
{
    private const ALLOWED_EXTENSIONS = [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx',
        'jpg', 'jpeg', 'png', 'txt', 'zip',
    ];

    private const VISIBILITY_OPTIONS = [
        ProjectDocument::VISIBILITY_ADMIN_ONLY,
        ProjectDocument::VISIBILITY_SPECIFIC,
        ProjectDocument::VISIBILITY_ALL,
    ];

    private function accessDenied(Request $request, Project $project)
    {
        $user = $request->user();

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return null;
        }

        if (!$user->projects->contains($project->id)) {
            return response()->json(['message' => 'Access denied to this project.'], 403);
        }

        return null;
    }

    /**
     * Per-document visibility: admins and the uploader always see it. Otherwise it depends
     * on the document's visibility mode: "all" (every project member), "specific" (only the
     * chosen assignees), or "admin_only" (nobody but admins/the uploader).
     */
    private function documentDenied(Request $request, ProjectDocument $doc)
    {
        $user = $request->user();

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return null;
        }

        if ((int) $doc->uploaded_by === (int) $user->id) {
            return null;
        }

        if ($doc->visibility === ProjectDocument::VISIBILITY_ALL) {
            return null;
        }

        if ($doc->visibility === ProjectDocument::VISIBILITY_SPECIFIC
            && $doc->assignees->contains($user->id)) {
            return null;
        }

        return response()->json(['message' => 'Access denied to this document.'], 403);
    }

    private function permissionDenied(Request $request, string $permission)
    {
        if (!$request->user()->can($permission)) {
            return response()->json([
                'message' => 'Your role does not have permission to perform this action on documents.',
            ], 403);
        }

        return null;
    }

    /**
     * @param int[] $assigneeIds
     */
    private function validateAssignees(Project $project, string $visibility, array $assigneeIds): void
    {
        if ($visibility !== ProjectDocument::VISIBILITY_SPECIFIC) {
            return;
        }

        $memberIds = $project->users()->pluck('users.id')->all();
        $invalid = array_diff($assigneeIds, $memberIds);
        if (!empty($invalid)) {
            throw ValidationException::withMessages([
                'assignees' => ['One or more selected users are not members of this project.'],
            ]);
        }
    }

    private function present(ProjectDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'project_id' => $doc->project_id,
            'name' => $doc->name,
            'document_type' => $doc->document_type,
            'description' => $doc->description,
            'file_name' => $doc->file_name,
            'mime_type' => $doc->mime_type,
            'file_size' => $doc->file_size,
            'uploaded_by' => $doc->uploader?->name,
            'visibility' => $doc->visibility,
            'assignees' => $doc->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'created_at' => $doc->created_at,
        ];
    }

    public function index(Request $request, $projectId)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }
            if ($resp = $this->permissionDenied($request, 'documents.view')) {
                return $resp;
            }

            $user = $request->user();
            $query = ProjectDocument::where('project_id', $projectId)
                ->with(['uploader:id,name', 'assignees:id,name']);

            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                $query->where(function ($q) use ($user) {
                    $q->where('uploaded_by', $user->id)
                        ->orWhere('visibility', ProjectDocument::VISIBILITY_ALL)
                        ->orWhere(function ($sub) use ($user) {
                            $sub->where('visibility', ProjectDocument::VISIBILITY_SPECIFIC)
                                ->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id));
                        });
                });
            }

            $docs = $query->orderBy('created_at', 'desc')->get()->map(fn ($d) => $this->present($d));

            return response()->json($docs);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load project documents.'], 500);
        }
    }

    public function assignableUsers(Request $request, $projectId)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }
            if (!$request->user()->can('documents.create') && !$request->user()->can('documents.edit')) {
                return response()->json([
                    'message' => 'Your role does not have permission to perform this action on documents.',
                ], 403);
            }

            $users = $project->users()
                ->orderBy('name')
                ->get(['users.id', 'users.name', 'users.email'])
                ->filter(fn ($u) => !$u->hasAnyRole(['super_admin', 'admin']))
                ->values()
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email]);

            return response()->json($users);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load assignable users.'], 500);
        }
    }

    public function store(Request $request, $projectId)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }
            if ($resp = $this->permissionDenied($request, 'documents.create')) {
                return $resp;
            }

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'document_type' => ['nullable', 'string', 'max:100'],
                'description' => ['nullable', 'string'],
                'visibility' => ['required', 'string', 'in:' . implode(',', self::VISIBILITY_OPTIONS)],
                'assignees' => ['required_if:visibility,specific', 'array'],
                'assignees.*' => ['integer', 'exists:users,id'],
                'file' => ['required', 'file', 'max:20480'],
            ]);

            $assigneeIds = $validated['assignees'] ?? [];
            $this->validateAssignees($project, $validated['visibility'], $assigneeIds);

            $file = $request->file('file');

            // Laravel's `mimes` rule guesses the extension from the sniffed MIME type, which is
            // unreliable for zip-based Office formats (.xlsx/.docx/.pptx can be sniffed as "zip").
            // Checking the extension directly avoids false-positive rejections of valid files.
            $ext = strtolower($file->getClientOriginalExtension());
            if (!in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
                throw ValidationException::withMessages([
                    'file' => ['Unsupported file type. Allowed: ' . implode(', ', self::ALLOWED_EXTENSIONS) . '.'],
                ]);
            }

            $storedName = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs("project-documents/{$project->id}", $storedName, 'local');

            $doc = ProjectDocument::create([
                'project_id' => $project->id,
                'name' => $validated['name'],
                'document_type' => $validated['document_type'] ?? null,
                'description' => $validated['description'] ?? null,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
                'visibility' => $validated['visibility'],
            ]);

            if ($validated['visibility'] === ProjectDocument::VISIBILITY_SPECIFIC) {
                $doc->assignees()->sync($assigneeIds);
            }

            $doc->load(['uploader:id,name', 'assignees:id,name']);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
                'action' => "Uploaded document \"{$doc->name}\"",
                'entity' => 'Document',
                'entity_id' => (string) $doc->id,
            ]);

            return response()->json($this->present($doc), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to upload document.'], 500);
        }
    }

    public function update(Request $request, $projectId, $id)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }

            $doc = ProjectDocument::where('project_id', $projectId)->with('assignees:id')->findOrFail($id);
            if ($resp = $this->documentDenied($request, $doc)) {
                return $resp;
            }
            if ($resp = $this->permissionDenied($request, 'documents.edit')) {
                return $resp;
            }

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'document_type' => ['nullable', 'string', 'max:100'],
                'description' => ['nullable', 'string'],
                'visibility' => ['required', 'string', 'in:' . implode(',', self::VISIBILITY_OPTIONS)],
                'assignees' => ['required_if:visibility,specific', 'array'],
                'assignees.*' => ['integer', 'exists:users,id'],
            ]);

            $assigneeIds = $validated['assignees'] ?? [];
            $this->validateAssignees($project, $validated['visibility'], $assigneeIds);

            $doc->update([
                'name' => $validated['name'],
                'document_type' => $validated['document_type'] ?? null,
                'description' => $validated['description'] ?? null,
                'visibility' => $validated['visibility'],
            ]);

            $doc->assignees()->sync(
                $validated['visibility'] === ProjectDocument::VISIBILITY_SPECIFIC ? $assigneeIds : []
            );

            $doc->load(['uploader:id,name', 'assignees:id,name']);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
                'action' => "Updated document \"{$doc->name}\"",
                'entity' => 'Document',
                'entity_id' => (string) $doc->id,
            ]);

            return response()->json($this->present($doc));
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Document not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update document.'], 500);
        }
    }

    public function download(Request $request, $projectId, $id)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }

            $doc = ProjectDocument::where('project_id', $projectId)->with('assignees:id')->findOrFail($id);
            if ($resp = $this->documentDenied($request, $doc)) {
                return $resp;
            }
            if ($resp = $this->permissionDenied($request, 'documents.view')) {
                return $resp;
            }

            if (!Storage::disk('local')->exists($doc->file_path)) {
                return response()->json(['message' => 'File not found on server.'], 404);
            }

            return Storage::disk('local')->download($doc->file_path, $doc->file_name);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Document not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to download document.'], 500);
        }
    }

    public function destroy(Request $request, $projectId, $id)
    {
        try {
            $project = Project::findOrFail($projectId);
            if ($resp = $this->accessDenied($request, $project)) {
                return $resp;
            }

            $doc = ProjectDocument::where('project_id', $projectId)->with('assignees:id')->findOrFail($id);
            if ($resp = $this->documentDenied($request, $doc)) {
                return $resp;
            }
            if ($resp = $this->permissionDenied($request, 'documents.delete')) {
                return $resp;
            }

            $name = $doc->name;

            if (Storage::disk('local')->exists($doc->file_path)) {
                Storage::disk('local')->delete($doc->file_path);
            }
            $doc->delete();

            ActivityLog::create([
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'action' => "Deleted document \"{$name}\"",
                'entity' => 'Document',
                'entity_id' => (string) $id,
            ]);

            return response()->json(['message' => 'Document deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Document not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete document.'], 500);
        }
    }
}
