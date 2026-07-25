<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Revenue;
use App\Models\Expense;
use App\Models\OwnerPayment;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Throwable;

class FinancialController extends Controller
{
    private function getModel(string $type)
    {
        return match ($type) {
            'budgets' => Budget::class,
            'revenues' => Revenue::class,
            'expenses' => Expense::class,
            'owner_payments' => OwnerPayment::class,
            default => abort(400, "Invalid financial module type"),
        };
    }

    public function index(Request $request, $type)
    {
        try {
            $request->validate(['project_id' => 'required|exists:projects,id']);
            $model = $this->getModel($type);

            $items = $model::where('project_id', $request->project_id)
                ->orderBy('date', 'desc')
                ->get();

            return response()->json($items);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load financial records.'], 500);
        }
    }

    public function store(Request $request, $type)
    {
        try {
            $model = $this->getModel($type);

            $validated = $request->validate([
                'project_id' => 'required|exists:projects,id',
                'amount' => 'required|numeric|min:0',
                'date' => 'required|date',
                'category' => 'nullable|string|max:255',
                'source' => 'nullable|string|max:255',
                'paid_to' => 'nullable|string|max:255',
                'payment_method' => 'nullable|string|max:255',
                'reference_no' => 'nullable|string|max:255',
                'description' => 'nullable|string',
            ]);

            $item = $model::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            $singular = rtrim(ucfirst(str_replace('_', ' ', $type)), 's');
            ActivityLog::create([
                'project_id' => $item->project_id,
                'user_id' => $request->user()->id,
                'action' => "Added {$singular}",
                'entity' => $singular,
                'entity_id' => (string)$item->id,
                'meta' => ['amount' => $item->amount],
            ]);

            return response()->json($item, 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to save financial entry.'], 500);
        }
    }

    public function update(Request $request, $type, $id)
    {
        try {
            $model = $this->getModel($type);
            $item = $model::findOrFail($id);

            $validated = $request->validate([
                'amount' => 'required|numeric|min:0',
                'date' => 'required|date',
                'category' => 'nullable|string|max:255',
                'source' => 'nullable|string|max:255',
                'paid_to' => 'nullable|string|max:255',
                'payment_method' => 'nullable|string|max:255',
                'reference_no' => 'nullable|string|max:255',
                'description' => 'nullable|string',
            ]);

            $item->update($validated);

            $singular = rtrim(ucfirst(str_replace('_', ' ', $type)), 's');
            ActivityLog::create([
                'project_id' => $item->project_id,
                'user_id' => $request->user()->id,
                'action' => "Updated {$singular}",
                'entity' => $singular,
                'entity_id' => (string)$item->id,
                'meta' => ['amount' => $item->amount],
            ]);

            return response()->json($item);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Financial record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update financial entry.'], 500);
        }
    }

    public function destroy(Request $request, $type, $id)
    {
        try {
            $model = $this->getModel($type);
            $item = $model::findOrFail($id);
            $projectId = $item->project_id;
            $amount = $item->amount;

            $item->delete();

            $singular = rtrim(ucfirst(str_replace('_', ' ', $type)), 's');
            ActivityLog::create([
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'action' => "Deleted {$singular}",
                'entity' => $singular,
                'entity_id' => (string)$id,
                'meta' => ['amount' => $amount],
            ]);

            return response()->json(['message' => "{$singular} record deleted successfully"]);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Financial record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete financial record.'], 500);
        }
    }
}
