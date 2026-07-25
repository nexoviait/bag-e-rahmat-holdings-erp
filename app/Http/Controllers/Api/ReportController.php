<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Budget;
use App\Models\Revenue;
use App\Models\Expense;
use App\Models\OwnerPayment;
use App\Models\Shareholder;
use App\Models\ShareholderInvestment;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Throwable;

class ReportController extends Controller
{
    public function dashboardTotals(Request $request)
    {
        try {
            $user = $request->user();

            if ($user->hasAnyRole(['super_admin', 'admin'])) {
                $projectIds = Project::pluck('id')->toArray();
            } else {
                $assignedIds = $user->projects()->pluck('projects.id')->toArray();
                $shProjectIds = Shareholder::where('user_id', $user->id)->pluck('project_id')->toArray();
                $projectIds = array_unique(array_merge($assignedIds, $shProjectIds));
            }

            $budget = Project::whereIn('id', $projectIds)->sum('total_shareholder_project_price');
            $revenue = Revenue::whereIn('project_id', $projectIds)->sum('amount');
            $expenses = Expense::whereIn('project_id', $projectIds)->sum('amount');
            $payments = OwnerPayment::whereIn('project_id', $projectIds)->sum('amount');
            $investments = ShareholderInvestment::whereIn('project_id', $projectIds)->sum('amount');

            $recentLogs = ActivityLog::whereIn('project_id', $projectIds)
                ->orWhereNull('project_id')
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();

            return response()->json([
                'budget' => (float)$budget,
                'revenue' => (float)$revenue,
                'expenses' => (float)$expenses,
                'payments' => (float)$payments,
                'investments' => (float)$investments,
                'recentLogs' => $recentLogs,
            ]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to calculate dashboard totals.'], 500);
        }
    }

    public function projectSummary(Request $request, $projectId)
    {
        try {
            $b = Budget::where('project_id', $projectId)->get();
            $r = Revenue::where('project_id', $projectId)->get();
            $e = Expense::where('project_id', $projectId)->get();
            $o = OwnerPayment::where('project_id', $projectId)->get();
            $si = ShareholderInvestment::where('project_id', $projectId)->get();

            return response()->json([
                'budget' => (float)$b->sum('amount'),
                'revenue' => (float)$r->sum('amount'),
                'expenses' => (float)$e->sum('amount'),
                'owner' => (float)$o->sum('amount'),
                'invest' => (float)$si->sum('amount'),
                'expensesRows' => $e,
                'revenuesRows' => $r,
            ]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to calculate project summary.'], 500);
        }
    }

    public function projectReport(Request $request, $projectId)
    {
        try {
            $b = Budget::where('project_id', $projectId)->get();
            $r = Revenue::where('project_id', $projectId)->get();
            $e = Expense::where('project_id', $projectId)->get();
            $o = OwnerPayment::where('project_id', $projectId)->get();
            $si = ShareholderInvestment::where('project_id', $projectId)->get();
            $sh = Shareholder::where('project_id', $projectId)->with(['user', 'project'])->get();
            $logs = ActivityLog::where('project_id', $projectId)->orderBy('created_at', 'desc')->limit(30)->get();

            return response()->json([
                'budgets' => $b,
                'revenues' => $r,
                'expenses' => $e,
                'ownerPayments' => $o,
                'shareholderInvestments' => $si,
                'shareholders' => $sh,
                'logs' => $logs,
            ]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to generate financial report.'], 500);
        }
    }

    public function projectRecent(Request $request, $projectId)
    {
        try {
            $r = Revenue::where('project_id', $projectId)->select('id', 'amount', 'date', 'source as label', 'description')->orderBy('date', 'desc')->limit(5)->get()->map(fn($x) => array_merge($x->toArray(), ['kind' => 'Revenue']));
            $e = Expense::where('project_id', $projectId)->select('id', 'amount', 'date', 'category as label', 'description')->orderBy('date', 'desc')->limit(5)->get()->map(fn($x) => array_merge($x->toArray(), ['kind' => 'Expense']));
            $o = OwnerPayment::where('project_id', $projectId)->select('id', 'amount', 'date', 'paid_to as label', 'description')->orderBy('date', 'desc')->limit(5)->get()->map(fn($x) => array_merge($x->toArray(), ['kind' => 'Owner Payment']));

            $combined = collect([...$r, ...$e, ...$o])
                ->sortByDesc('date')
                ->take(8)
                ->values();

            return response()->json($combined);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Unable to load recent transactions.'], 500);
        }
    }
}
