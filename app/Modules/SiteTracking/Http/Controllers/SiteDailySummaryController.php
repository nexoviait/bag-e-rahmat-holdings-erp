<?php

namespace App\Modules\SiteTracking\Http\Controllers;

use App\Models\Expense;
use App\Models\Project;
use App\Models\Revenue;
use App\Modules\SiteTracking\Services\LaborLogService;
use App\Modules\SiteTracking\Services\MaterialTransactionService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

/**
 * The one genuinely new aggregation endpoint this module adds: given a
 * project + a single date, return that day's expense/revenue/materials-cost/
 * labor-cost totals plus a merged timeline of every entry recorded that day —
 * so the Daily Log tab doesn't need 4 separate round trips per date view.
 *
 * Gated on 'reports.view' (an existing, already-broadly-granted permission)
 * rather than a new one — this endpoint only *reads* across modules, it
 * doesn't need materials.view/labor.view specifically, since a project member
 * who can see financial reports should reasonably see this rollup too.
 */
class SiteDailySummaryController extends SiteTrackingController
{
    public function __construct(
        private readonly MaterialTransactionService $materialTransactions,
        private readonly LaborLogService $laborLogs,
    ) {}

    public function show(Request $request, $id)
    {
        try {
            $request->validate(['date' => 'required|date']);
            $date = $request->query('date');
            $projectId = (int) $id;

            $user = $request->user();
            $isMember = $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($projectId);
            if (!$user->can('reports.view') || !$isMember) {
                return response()->json(['message' => 'You do not have permission to view this project\'s daily summary.'], 403);
            }

            Project::findOrFail($projectId);

            $expenseRows = Expense::where('project_id', $projectId)->whereDate('date', $date)->get();
            $revenueRows = Revenue::where('project_id', $projectId)->whereDate('date', $date)->get();
            $materialRows = $this->materialTransactions->listForProject($projectId, $date);
            $laborRows = $this->laborLogs->listForProject($projectId, $date);

            $expenses = (float) $expenseRows->sum('amount');
            $revenue = (float) $revenueRows->sum('amount');
            $materialsCost = (float) $materialRows->where('type', 'in')->sum('total_cost');
            $laborCost = (float) $laborRows->sum('total_cost');

            $timeline = collect()
                ->concat($expenseRows->map(fn ($r) => [
                    'kind' => 'Expense', 'id' => $r->id, 'amount' => (float) $r->amount,
                    'label' => $r->category, 'description' => $r->description, 'created_at' => $r->created_at,
                    // Relative to the frontend's `api` axios instance, whose
                    // baseURL is already "/api/v1" — prefixing it again here
                    // would double up and 404.
                    'receipt_url' => $r->receipt_path ? "/financials/expenses/{$r->id}/receipt" : null,
                ]))
                ->concat($revenueRows->map(fn ($r) => [
                    'kind' => 'Revenue', 'id' => $r->id, 'amount' => (float) $r->amount,
                    'label' => $r->source, 'description' => $r->description, 'created_at' => $r->created_at,
                    'receipt_url' => $r->receipt_path ? "/financials/revenues/{$r->id}/receipt" : null,
                ]))
                ->concat($materialRows->map(function ($r) {
                    // Quantity is optional (a lump-sum purchase like "Sanitary
                    // materials" often has none) — fall back to the material
                    // name alone rather than printing a blank quantity.
                    $label = $r->quantity !== null
                        ? "{$r->quantity} {$r->material->unit} of \"{$r->material->name}\""
                        : "\"{$r->material->name}\"";
                    $tag = $r->type === 'in' && $r->supplier ? "Supplier: {$r->supplier}" : null;
                    $workItem = $r->used_for ? "Work item: {$r->used_for}" : null;

                    return [
                        'kind' => $r->type === 'in' ? 'Material In' : 'Material Out',
                        'id' => $r->id,
                        'amount' => $r->total_cost !== null ? (float) $r->total_cost : null,
                        'label' => $label,
                        'description' => implode(' · ', array_filter([$tag, $workItem])) ?: null,
                        'created_at' => $r->created_at,
                    ];
                }))
                ->concat($laborRows->map(fn ($r) => [
                    'kind' => 'Labor', 'id' => $r->id, 'amount' => (float) $r->total_cost,
                    'label' => "{$r->headcount} × {$r->labor_type}", 'description' => $r->notes, 'created_at' => $r->created_at,
                ]))
                ->sortByDesc('created_at')
                ->values();

            return response()->json([
                'date' => $date,
                'expenses' => $expenses,
                'revenue' => $revenue,
                'materialsCost' => $materialsCost,
                'laborCost' => $laborCost,
                'net' => $revenue - $expenses - $materialsCost - $laborCost,
                'timeline' => $timeline,
            ]);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Project not found.'], 404);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load the daily summary.'], 500);
        }
    }
}
