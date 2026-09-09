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
use Throwable;

class MaterialController extends SiteTrackingController
{
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
            $material = $this->materials->create($data, $request->user());

            return response()->json(new MaterialResource($material), 201);
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
            $material = $this->materials->update($material, $data, $request->user());

            return response()->json(new MaterialResource($material));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material not found.'], 404);
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
}
