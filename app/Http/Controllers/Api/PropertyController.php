<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\PropertyDocument;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Own Property — a user's personal property portfolio, company-wide and not
 * project-scoped. Strictly private by default: only the owner sees their own
 * records ('properties.view'). Super Admin and Admin can see everyone's
 * ('properties.view_all'), matching this app's Documents/CCTV full-visibility
 * trust model. Selling a property or offering it to the company for
 * development doesn't happen directly here — it's a request (see
 * PropertyRequestController) that only Super Admin can approve.
 */
class PropertyController extends Controller
{
    private const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
    private const MAX_FILE_KB = 20480;
    private const TYPES = ['land', 'flat', 'building', 'other'];

    private function present(Property $p, bool $withDetails = false): array
    {
        $data = [
            'id' => $p->id,
            'owner_id' => $p->owner_id,
            'owner_name' => $p->owner?->name,
            'title' => $p->title,
            'type' => $p->type,
            'location' => $p->location,
            'description' => $p->description,
            'estimated_value' => $p->estimated_value,
            'status' => $p->status,
            'created_at' => $p->created_at,
        ];

        if ($withDetails) {
            $data['documents'] = $p->documents->map(fn ($d) => [
                'id' => $d->id,
                'label' => $d->label,
                'file_name' => $d->file_name,
            ])->values();
            $data['requests'] = $p->requests->sortByDesc('id')->values()->map(fn ($r) => [
                'id' => $r->id,
                'kind' => $r->kind,
                'asking_price' => $r->asking_price,
                'details' => $r->details,
                'status' => $r->status,
                'admin_notes' => $r->admin_notes,
                'reviewed_by' => $r->reviewer?->name,
                'reviewed_at' => $r->reviewed_at,
                'created_at' => $r->created_at,
            ]);
        }

        return $data;
    }

    public function index(Request $request)
    {
        try {
            $user = $request->user();

            if ($request->boolean('all')) {
                if (!$user->can('properties.view_all')) {
                    return response()->json(['message' => 'Your role does not have permission to view all properties.'], 403);
                }
                $items = Property::with('owner')->orderBy('created_at', 'desc')->get();
                return response()->json($items->map(fn ($p) => $this->present($p)));
            }

            if (!$user->can('properties.view')) {
                return response()->json(['message' => 'Your role does not have permission to view properties.'], 403);
            }

            $items = Property::where('owner_id', $user->id)->orderBy('created_at', 'desc')->get();
            return response()->json($items->map(fn ($p) => $this->present($p)));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load properties.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            $item = Property::with(['owner', 'documents', 'requests.reviewer'])->findOrFail($id);

            if ((int) $item->owner_id !== (int) $user->id && !$user->can('properties.view_all')) {
                return response()->json(['message' => 'You do not have access to this property.'], 403);
            }

            return response()->json($this->present($item, true));
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Property not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load property.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->can('properties.create')) {
                return response()->json(['message' => 'Your role does not have permission to add a property.'], 403);
            }

            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'type' => 'required|in:' . implode(',', self::TYPES),
                'location' => 'required|string|max:255',
                'description' => 'nullable|string',
                'estimated_value' => 'nullable|numeric|min:0',
                'labels' => 'nullable|array',
                'labels.*' => 'nullable|string|max:100',
                'documents' => 'nullable|array',
                'documents.*' => 'file|max:' . self::MAX_FILE_KB,
            ]);

            foreach ($request->file('documents', []) as $file) {
                $ext = strtolower($file->getClientOriginalExtension());
                if (!in_array($ext, self::DOC_EXTENSIONS, true)) {
                    throw ValidationException::withMessages([
                        'documents' => ['Unsupported file type. Allowed: ' . implode(', ', self::DOC_EXTENSIONS) . '.'],
                    ]);
                }
            }

            $item = DB::transaction(function () use ($user, $validated, $request) {
                $property = Property::create([
                    'owner_id' => $user->id,
                    'title' => $validated['title'],
                    'type' => $validated['type'],
                    'location' => $validated['location'],
                    'description' => $validated['description'] ?? null,
                    'estimated_value' => $validated['estimated_value'] ?? null,
                    'status' => 'owned',
                ]);

                $labels = $request->input('labels', []);
                foreach ($request->file('documents', []) as $i => $file) {
                    $ext = strtolower($file->getClientOriginalExtension());
                    $path = $file->storeAs('properties/' . $property->id, Str::uuid() . '.' . $ext, 'local');
                    PropertyDocument::create([
                        'property_id' => $property->id,
                        'label' => $labels[$i] ?? 'Document',
                        'file_path' => $path,
                        'file_name' => $file->getClientOriginalName(),
                    ]);
                }

                return $property;
            });

            $item->load(['owner', 'documents']);

            return response()->json($this->present($item, true), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to add property.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $item = Property::with('documents')->findOrFail($id);
            $user = $request->user();

            if (!$user->can('properties.delete') && (int) $item->owner_id !== (int) $user->id) {
                return response()->json(['message' => 'You can only delete properties you own.'], 403);
            }

            foreach ($item->documents as $doc) {
                if (Storage::disk('local')->exists($doc->file_path)) {
                    Storage::disk('local')->delete($doc->file_path);
                }
            }
            $item->delete();

            return response()->json(['message' => 'Property deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Property not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete property.'], 500);
        }
    }

    public function downloadDocument(Request $request, $id, $docId)
    {
        try {
            $property = Property::findOrFail($id);
            $user = $request->user();

            if ((int) $property->owner_id !== (int) $user->id && !$user->can('properties.view_all')) {
                return response()->json(['message' => 'You do not have access to this document.'], 403);
            }

            $doc = PropertyDocument::where('property_id', $property->id)->findOrFail($docId);

            if (!Storage::disk('local')->exists($doc->file_path)) {
                return response()->json(['message' => 'File not found.'], 404);
            }

            return Storage::disk('local')->response($doc->file_path, $doc->file_name);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load document.'], 500);
        }
    }
}
