<?php

namespace App\Modules\SiteTracking\Http\Controllers;

use App\Models\Material;
use App\Modules\SiteTracking\DTO\MaterialTransactionData;
use App\Modules\SiteTracking\Http\Requests\StoreMaterialTransactionRequest;
use App\Modules\SiteTracking\Http\Requests\UpdateMaterialTransactionRequest;
use App\Modules\SiteTracking\Http\Resources\MaterialTransactionResource;
use App\Modules\SiteTracking\Services\MaterialTransactionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

/**
 * Authorization here is delegated through the Material policy (transactions
 * don't get their own Policy class — a material_transaction's authorization
 * question is always "can this user touch materials for this project", which
 * is exactly what MaterialPolicy already answers). update()/destroy() pass
 * $transaction->material — a real Material instance — into the same policy.
 */
class MaterialTransactionController extends SiteTrackingController
{
    public function __construct(
        private readonly MaterialTransactionService $transactions,
    ) {}

    public function index(Request $request)
    {
        try {
            $request->validate([
                'project_id' => 'required|integer|exists:projects,id',
                'date' => 'nullable|date',
            ]);
            $projectId = (int) $request->query('project_id');
            $this->authorize('viewAny', [Material::class, $projectId]);

            $transactions = $this->transactions->listForProject($projectId, $request->query('date'));

            return response()->json(MaterialTransactionResource::collection($transactions));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view material transactions.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load material transactions.'], 500);
        }
    }

    public function store(StoreMaterialTransactionRequest $request)
    {
        try {
            $data = MaterialTransactionData::fromArray($request->validated());
            $this->authorize('create', [Material::class, $data->projectId]);

            $transaction = $this->transactions->create($data, $request->user());

            return response()->json(new MaterialTransactionResource($transaction), 201);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to record material transactions.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to save material transaction.'], 500);
        }
    }

    public function update(UpdateMaterialTransactionRequest $request, $id)
    {
        try {
            $transaction = $this->transactions->find((int) $id);
            $this->authorize('update', $transaction->material);

            $data = MaterialTransactionData::fromArray($request->validated());
            $transaction = $this->transactions->update($transaction, $data, $request->user());

            return response()->json(new MaterialTransactionResource($transaction));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material transaction not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to edit this transaction.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update material transaction.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $transaction = $this->transactions->find((int) $id);
            $this->authorize('delete', $transaction->material);

            $this->transactions->delete($transaction, $request->user());

            return response()->json(['message' => 'Material transaction deleted successfully']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Material transaction not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to delete this transaction.'], 403);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to delete material transaction.'], 500);
        }
    }
}
