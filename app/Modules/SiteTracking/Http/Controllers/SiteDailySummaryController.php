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
 * project + a date (or an inclusive date range, via `date_to` — the Daily Log
 * tab's Weekly/Monthly/Custom views), return that period's expense/revenue/
 * materials-cost/labor-cost totals plus a merged timeline of every entry
 * recorded in it — so the Daily Log tab doesn't need 4 separate round trips
 * per view.
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
            $request->validate([
                'date' => 'required|date',
                'date_to' => 'nullable|date|after_or_equal:date',
            ]);
            $date = $request->query('date');
            $dateTo = $request->query('date_to');
            $projectId = (int) $id;

            $user = $request->user();
            $isMember = $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($projectId);
            if (!$user->can('reports.view') || !$isMember) {
                return response()->json(['message' => 'You do not have permission to view this project\'s daily summary.'], 403);
            }

            Project::findOrFail($projectId);

            $expenseQuery = Expense::where('project_id', $projectId);
            $revenueQuery = Revenue::where('project_id', $projectId);
            if ($dateTo) {
                $expenseQuery->whereDate('date', '>=', $date)->whereDate('date', '<=', $dateTo);
                $revenueQuery->whereDate('date', '>=', $date)->whereDate('date', '<=', $dateTo);
            } else {
                $expenseQuery->whereDate('date', $date);
                $revenueQuery->whereDate('date', $date);
            }
            $expenseRows = $expenseQuery->get();
            $revenueRows = $revenueQuery->get();
            $materialRows = $this->materialTransactions->listForProject($projectId, $date, $dateTo);
            $laborRows = $this->laborLogs->listForProject($projectId, $date, $dateTo);

            $expenses = (float) $expenseRows->sum('amount');
            $revenue = (float) $revenueRows->sum('amount');
            // total_cost alone would silently drop transportation/carrying
            // costs from the day's materials total — those are stored as
            // their own columns (see MaterialTransactionData) but still count
            // toward the all-in cost shown here.
            $materialsCost = (float) $materialRows->where('type', 'in')->sum(
                fn ($r) => (float) ($r->total_cost ?? 0) + (float) ($r->transportation_cost ?? 0) + (float) ($r->carrying_cost ?? 0)
            );
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
                'date_to' => $dateTo,
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
