<?php

namespace App\Modules\SiteTracking\Http\Controllers;

use App\Models\Material;
use App\Modules\SiteTracking\DTO\MaterialData;
use App\Modules\SiteTracking\Http\Requests\StoreMaterialRequest;
use App\Modules\SiteTracking\Http\Requests\UpdateMaterialRequest;
use App\Modules\SiteTracking\Http\Resources\MaterialResource;
use App\Modules\SiteTracking\Services\MaterialService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MaterialController extends SiteTrackingController
{
    // Same allowlist as MaterialTransactionController's receipt — a product
    // photo or a scanned/PDF spec sheet, nothing else.
    private const ATTACHMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

    public function __construct(
        private readonly MaterialService $materials,
    ) {}

    public function index(Request $request)
    {
        try {
            $request->validate(['project_id' => 'required|integer|exists:projects,id']);
            $projectId = (int) $request->query('project_id');
            $this->authorize('viewAny', [Material::class, $projectId]);

            $materials = $this->materials->listWithStock($projectId);

            return response()->json(MaterialResource::collection($materials));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view materials.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load materials list.'], 500);
        }
    }

    public function store(StoreMaterialRequest $request)
    {
        try {
            $data = MaterialData::fromArray($request->validated());
            $this->authorize('create', [Material::class, $data->projectId]);

            if ($request->hasFile('attachment')) {
                $data = $data->withAttachment($this->handleAttachmentUpload($request, $data->projectId));
            }

            $material = $this->materials->create($data, $request->user());

            return response()->json(new MaterialResource($material), 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to add materials.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to create material.'], 500);
        }
    }

    public function update(UpdateMaterialRequest $request, $id)
    {
        try {
            $material = $this->materials->find((int) $id);
            $this->authorize('update', $material);

            $data = MaterialData::fromArray($request->validated());

            if ($request->hasFile('attachment')) {
                $data = $data->withAttachment($this->handleAttachmentUpload($request, $data->projectId));
                $this->deleteAttachmentFile($material);
            }

            $material = $this->materials->update($material, $data, $request->user());

            return response()->json(new MaterialResource($material));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material not found.'], 404);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to edit this material.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update material.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $material = $this->materials->find((int) $id);
            $this->authorize('delete', $material);

            $this->deleteAttachmentFile($material);
            $this->materials->delete($material, $request->user());

            return response()->json(['message' => 'Material deleted successfully']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to delete this material.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to delete material.'], 500);
        }
    }

    /**
     * Authenticated-proxy download/inline-preview — same shape as
     * MaterialTransactionController::receipt() and every other file-serving
     * endpoint in this app. Never the public disk.
     */
    public function attachment(Request $request, $id)
    {
        try {
            $material = $this->materials->find((int) $id);
            $this->authorize('view', $material);

            if (!$material->attachment_path || !Storage::disk('local')->exists($material->attachment_path)) {
                return response()->json(['message' => 'Attachment not found.'], 404);
            }

            return Storage::disk('local')->response(
                $material->attachment_path,
                $material->attachment_name,
                ['Content-Type' => $material->attachment_mime ?? 'application/octet-stream']
            );
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this attachment.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load attachment.'], 500);
        }
    }

    private function handleAttachmentUpload(Request $request, int $projectId): array
    {
        $file = $request->file('attachment');
        $ext = strtolower($file->getClientOriginalExtension());

        if (!in_array($ext, self::ATTACHMENT_EXTENSIONS, true)) {
            throw ValidationException::withMessages([
                'attachment' => ['Unsupported file type. Allowed: ' . implode(', ', self::ATTACHMENT_EXTENSIONS) . '.'],
            ]);
        }

        $storedName = Str::uuid() . '.' . $ext;
        $path = $file->storeAs("material-attachments/{$projectId}", $storedName, 'local');

        return [
            'attachment_path' => $path,
            'attachment_name' => $file->getClientOriginalName(),
            'attachment_mime' => $file->getClientMimeType(),
        ];
    }

    private function deleteAttachmentFile(Material $material): void
    {
        if ($material->attachment_path && Storage::disk('local')->exists($material->attachment_path)) {
            Storage::disk('local')->delete($material->attachment_path);
        }
    }
}
