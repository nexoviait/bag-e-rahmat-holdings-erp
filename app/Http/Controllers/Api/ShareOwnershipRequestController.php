<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Shareholder;
use App\Models\ShareOwnershipRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * "Apply for Others" — Share Transfer and Share Sell requests. Both move a
 * slice of one shareholder's stake to someone else; 'sell' is the same
 * mechanic with an added sale_price. Approving one (super_admin only —
 * see the applications.approve permission) directly rewrites the
 * shareholders table: the FROM shareholder's ownership_pct/share_count
 * shrinks by the requested amount, and either an existing Shareholder row
 * for the recipient grows by the same amount, or a brand-new one is created.
 */
class ShareOwnershipRequestController extends Controller
{
    private function present(ShareOwnershipRequest $r): array
    {
        return [
            'id' => $r->id,
            'kind' => $r->kind,
            'shareholder_id' => $r->shareholder_id,
            'shareholder_name' => $r->shareholder?->name,
            'project_id' => $r->shareholder?->project_id,
            'project_name' => $r->shareholder?->project?->name,
            'to_user_id' => $r->to_user_id,
            'to_name' => $r->to_name,
            'to_email' => $r->to_email,
            'to_phone' => $r->to_phone,
            'percentage' => $r->percentage,
            'share_count' => $r->share_count,
            'sale_price' => $r->sale_price,
            'reason' => $r->reason,
            'status' => $r->status,
            'approved_by' => $r->approver?->name,
            'approved_at' => $r->approved_at,
            'created_by' => $r->creator?->name,
            'created_by_id' => $r->created_by,
            'created_at' => $r->created_at,
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
                if (!$user->can('applications.view')) {
                    return response()->json(['message' => 'Your role does not have permission to view requests.'], 403);
                }

                $items = ShareOwnershipRequest::where('shareholder_id', $shareholder->id)
                    ->with(['shareholder.project', 'approver', 'creator'])
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn ($r) => $this->present($r));

                return response()->json($items);
            }

            if (!$user->hasAnyRole(['super_admin', 'admin'])) {
                return response()->json(['message' => 'You do not have permission to view all requests.'], 403);
            }

            $items = ShareOwnershipRequest::with(['shareholder.project', 'approver', 'creator'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn ($r) => $this->present($r));

            return response()->json($items);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder not found.'], 404);
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

            $shareholder = Shareholder::findOrFail($request->input('shareholder_id'));
            if (!$user->canAccessProject($shareholder->project_id)) {
                return response()->json(['message' => 'You do not have access to this project.'], 403);
            }

            $validated = $request->validate([
                'shareholder_id' => 'required|exists:shareholders,id',
                'kind' => 'required|in:transfer,sell',
                'to_user_id' => 'nullable|exists:users,id',
                'to_name' => 'required|string|max:255',
                'to_email' => 'nullable|email|max:255',
                'to_phone' => 'nullable|string|max:50',
                'percentage' => 'nullable|numeric|min:0.01|max:100',
                'share_count' => 'nullable|integer|min:1',
                'sale_price' => 'required_if:kind,sell|nullable|numeric|min:0',
                'reason' => 'nullable|string',
            ]);

            $usingShareCount = $shareholder->share_type === 'share_count';
            $requestedAmount = $usingShareCount ? ($validated['share_count'] ?? null) : ($validated['percentage'] ?? null);
            if (!$requestedAmount) {
                throw ValidationException::withMessages([
                    $usingShareCount ? 'share_count' : 'percentage' => ["This shareholder is tracked by " . ($usingShareCount ? 'share count' : 'percentage') . " — that field is required."],
                ]);
            }

            $available = $usingShareCount ? $shareholder->effective_share_count : $shareholder->effective_ownership_pct;
            if ($requestedAmount > $available + 0.01) {
                throw ValidationException::withMessages([
                    $usingShareCount ? 'share_count' : 'percentage' => ["\"{$shareholder->name}\" only holds {$available} — cannot request more than that."],
                ]);
            }

            $item = ShareOwnershipRequest::create([
                'shareholder_id' => $shareholder->id,
                'kind' => $validated['kind'],
                'to_user_id' => $validated['to_user_id'] ?? null,
                'to_name' => $validated['to_name'],
                'to_email' => $validated['to_email'] ?? null,
                'to_phone' => $validated['to_phone'] ?? null,
                'percentage' => $usingShareCount ? null : $requestedAmount,
                'share_count' => $usingShareCount ? $requestedAmount : null,
                'sale_price' => $validated['sale_price'] ?? null,
                'reason' => $validated['reason'] ?? null,
                'status' => 'pending',
                'created_by' => $user->id,
            ]);
            $item->load(['shareholder.project', 'creator']);

            ActivityLog::create([
                'project_id' => $shareholder->project_id,
                'user_id' => $user->id,
                'action' => ucfirst($validated['kind']) . " request: {$requestedAmount}" . ($usingShareCount ? ' shares' : '%') . " of \"{$shareholder->name}\" to \"{$validated['to_name']}\" — pending approval",
                'entity' => 'ShareOwnershipRequest',
                'entity_id' => (string) $item->id,
            ]);

            return response()->json($this->present($item), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Shareholder not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to submit request.'], 500);
        }
    }

    public function approve(Request $request, $id)
    {
        try {
            if (!$request->user()->can('applications.approve')) {
                return response()->json(['message' => 'Only Super Admin can approve share requests.'], 403);
            }

            $item = ShareOwnershipRequest::with('shareholder.project')->findOrFail($id);
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'This request has already been processed.'], 422);
            }

            $shareholder = $item->shareholder;
            $usingShareCount = $shareholder->share_type === 'share_count';
            $amount = $usingShareCount ? $item->share_count : $item->percentage;
            $available = $usingShareCount ? $shareholder->effective_share_count : $shareholder->effective_ownership_pct;

            if ($amount > $available + 0.01) {
                return response()->json([
                    'message' => "\"{$shareholder->name}\" no longer holds enough to fulfill this request (has {$available}, request needs {$amount}). It may need to be rejected instead.",
                ], 422);
            }

            DB::transaction(function () use ($item, $shareholder, $usingShareCount, $amount, $request) {
                // Shrink the sender's stake.
                if ($usingShareCount) {
                    $shareholder->decrement('share_count', $amount);
                } else {
                    $shareholder->decrement('ownership_pct', $amount);
                }

                // Grow (or create) the recipient's stake in the same project.
                $recipient = null;
                if ($item->to_user_id) {
                    $recipient = Shareholder::where('project_id', $shareholder->project_id)
                        ->where('user_id', $item->to_user_id)
                        ->first();
                }
                if (!$recipient) {
                    $recipient = Shareholder::where('project_id', $shareholder->project_id)
                        ->where('user_id', $item->to_user_id)
                        ->where('name', $item->to_name)
                        ->first();
                }

                if ($recipient) {
                    if ($usingShareCount) {
                        $recipient->increment('share_count', $amount);
                    } else {
                        $recipient->increment('ownership_pct', $amount);
                    }
                } else {
                    Shareholder::create([
                        'project_id' => $shareholder->project_id,
                        'user_id' => $item->to_user_id,
                        'name' => $item->to_name,
                        'email' => $item->to_email,
                        'phone' => $item->to_phone,
                        'share_type' => $shareholder->share_type,
                        'ownership_pct' => $usingShareCount ? 0 : $amount,
                        'share_count' => $usingShareCount ? $amount : 0,
                    ]);
                }

                $item->update([
                    'status' => 'approved',
                    'approved_by' => $request->user()->id,
                    'approved_at' => now(),
                ]);

                ActivityLog::create([
                    'project_id' => $shareholder->project_id,
                    'user_id' => $request->user()->id,
                    'action' => ucfirst($item->kind) . " approved: {$amount}" . ($usingShareCount ? ' shares' : '%') . " moved from \"{$shareholder->name}\" to \"{$item->to_name}\"",
                    'entity' => 'ShareOwnershipRequest',
                    'entity_id' => (string) $item->id,
                ]);
            });

            $item->load(['shareholder.project', 'approver', 'creator']);

            return response()->json($this->present($item));
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
                return response()->json(['message' => 'Only Super Admin can reject share requests.'], 403);
            }

            $item = ShareOwnershipRequest::with('shareholder')->findOrFail($id);
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'This request has already been processed.'], 422);
            }

            $item->update([
                'status' => 'rejected',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            ActivityLog::create([
                'project_id' => $item->shareholder->project_id,
                'user_id' => $request->user()->id,
                'action' => ucfirst($item->kind) . " request for \"{$item->shareholder->name}\" rejected",
                'entity' => 'ShareOwnershipRequest',
                'entity_id' => (string) $item->id,
            ]);

            $item->load(['shareholder.project', 'approver', 'creator']);

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
            $item = ShareOwnershipRequest::with('shareholder')->findOrFail($id);
            $user = $request->user();

            if (!$user->can('applications.delete') && (int) $item->created_by !== (int) $user->id) {
                return response()->json(['message' => 'You can only delete requests you submitted yourself.'], 403);
            }
            if ($item->status === 'approved') {
                return response()->json(['message' => 'An approved request cannot be deleted (it already changed ownership records).'], 422);
            }

            $item->delete();

            return response()->json(['message' => 'Request deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete request.'], 500);
        }
    }
}
