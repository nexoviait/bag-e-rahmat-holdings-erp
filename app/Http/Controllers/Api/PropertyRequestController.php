<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\PropertyRequest;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Sell / Development-for-BAG requests against a user's own property. These
 * are real business decisions (the company sanctioning a sale, or taking on
 * someone's personal property for development) so — like Share Transfer/Sell
 * and NOC — only Super Admin can approve, even though Admin otherwise
 * mirrors Super Admin across most of this app. Admin can still see every
 * request (properties.view_all) to stay informed, just not act on them.
 */
class PropertyRequestController extends Controller
{
    private function present(PropertyRequest $r): array
    {
        return [
            'id' => $r->id,
            'property_id' => $r->property_id,
            'property_title' => $r->property?->title,
            'owner_id' => $r->owner_id,
            'owner_name' => $r->owner?->name,
            'kind' => $r->kind,
            'asking_price' => $r->asking_price,
            'details' => $r->details,
            'status' => $r->status,
            'admin_notes' => $r->admin_notes,
            'reviewed_by' => $r->reviewer?->name,
            'reviewed_at' => $r->reviewed_at,
            'created_at' => $r->created_at,
        ];
    }

    public function index(Request $request)
    {
        try {
            $user = $request->user();

            if ($user->can('properties.approve') || $user->can('properties.view_all')) {
                $items = PropertyRequest::with(['property', 'owner', 'reviewer'])->orderBy('created_at', 'desc')->get();
            } else {
                if (!$user->can('properties.view')) {
                    return response()->json(['message' => 'Your role does not have permission to view requests.'], 403);
                }
                $items = PropertyRequest::where('owner_id', $user->id)
                    ->with(['property', 'owner', 'reviewer'])
                    ->orderBy('created_at', 'desc')
                    ->get();
            }

            return response()->json($items->map(fn ($r) => $this->present($r)));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load requests.'], 500);
        }
    }

    public function store(Request $request, $propertyId)
    {
        try {
            $user = $request->user();
            if (!$user->can('properties.create')) {
                return response()->json(['message' => 'Your role does not have permission to submit this request.'], 403);
            }

            $property = Property::findOrFail($propertyId);
            if ((int) $property->owner_id !== (int) $user->id) {
                return response()->json(['message' => 'You can only submit requests for your own property.'], 403);
            }

            $validated = $request->validate([
                'kind' => 'required|in:sell,development',
                'asking_price' => 'nullable|numeric|min:0',
                'details' => 'nullable|string',
            ]);

            $hasActive = PropertyRequest::where('property_id', $property->id)
                ->where('kind', $validated['kind'])
                ->whereIn('status', ['pending', 'approved'])
                ->exists();
            if ($hasActive) {
                return response()->json(['message' => 'An active request of this type already exists for this property.'], 422);
            }

            $item = PropertyRequest::create([
                'property_id' => $property->id,
                'owner_id' => $user->id,
                'kind' => $validated['kind'],
                'asking_price' => $validated['asking_price'] ?? null,
                'details' => $validated['details'] ?? null,
                'status' => 'pending',
            ]);
            $item->load(['property', 'owner']);

            return response()->json($this->present($item), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Property not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to submit request.'], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        try {
            if (!$request->user()->can('properties.approve')) {
                return response()->json(['message' => 'Only Super Admin can approve or reject this request.'], 403);
            }

            $item = PropertyRequest::with('property')->findOrFail($id);
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'This request has already been processed.'], 422);
            }

            $validated = $request->validate([
                'status' => 'required|in:approved,rejected',
                'admin_notes' => 'nullable|string',
            ]);

            $item->update([
                'status' => $validated['status'],
                'admin_notes' => $validated['admin_notes'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            if ($validated['status'] === 'approved' && $item->property) {
                $item->property->update([
                    'status' => $item->kind === 'sell' ? 'for_sale' : 'offered_for_development',
                ]);
            }

            $item->load(['property', 'owner', 'reviewer']);

            return response()->json($this->present($item));
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update request.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $item = PropertyRequest::findOrFail($id);
            $user = $request->user();

            if ((int) $item->owner_id !== (int) $user->id && !$user->can('properties.approve')) {
                return response()->json(['message' => 'You can only cancel requests you submitted yourself.'], 403);
            }
            if ($item->status !== 'pending') {
                return response()->json(['message' => 'Only pending requests can be cancelled.'], 422);
            }

            $item->delete();

            return response()->json(['message' => 'Request cancelled']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Request not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to cancel request.'], 500);
        }
    }
}
