<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Revenue;
use App\Models\Expense;
use App\Models\OwnerPayment;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class FinancialController extends Controller
{
    // Jpg/png/pdf only — a "money receipt" is either a photographed paper
    // receipt or a scanned/exported PDF, not a general document (that's what
    // ProjectDocumentController's broader type list is for).
    private const RECEIPT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

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

    /**
     * Validates and stores an optional 'receipt' upload, returning the three
     * model attributes to merge in — or an empty array when none was sent.
     * Shared by store()/update() so both stay in sync.
     */
    private function handleReceiptUpload(Request $request, string $type): array
    {
        if (!$request->hasFile('receipt')) {
            return [];
        }

        $file = $request->file('receipt');

        // Same reasoning as ProjectDocumentController: check the extension
        // directly rather than relying on the `mimes` rule's MIME-sniffing,
        // which is unreliable for some real-world phone-camera JPEGs.
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, self::RECEIPT_EXTENSIONS, true)) {
            throw ValidationException::withMessages([
                'receipt' => ['Unsupported file type. Allowed: ' . implode(', ', self::RECEIPT_EXTENSIONS) . '.'],
            ]);
        }

        $storedName = Str::uuid() . '.' . $ext;
        $path = $file->storeAs("financial-receipts/{$type}", $storedName, 'local');

        return [
            'receipt_path' => $path,
            'receipt_name' => $file->getClientOriginalName(),
            'receipt_mime' => $file->getClientMimeType(),
        ];
    }

    private function deleteReceiptFile(Model $item): void
    {
        if ($item->receipt_path && Storage::disk('local')->exists($item->receipt_path)) {
            Storage::disk('local')->delete($item->receipt_path);
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
                'receipt' => 'nullable|file|max:10240',
            ]);

            $receiptAttrs = $this->handleReceiptUpload($request, $type);

            $item = $model::create([
                ...collect($validated)->except('receipt')->all(),
                ...$receiptAttrs,
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
                'receipt' => 'nullable|file|max:10240',
            ]);

            // A new receipt REPLACES the old one — remove the old file so
            // uploads don't accumulate orphaned copies on disk. No file
            // uploaded means "leave the existing receipt as-is" (same
            // leave-blank-to-keep convention as the DVR password field).
            $receiptAttrs = $this->handleReceiptUpload($request, $type);
            if (!empty($receiptAttrs)) {
                $this->deleteReceiptFile($item);
            }

            $item->update([
                ...collect($validated)->except('receipt')->all(),
                ...$receiptAttrs,
            ]);

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

            $this->deleteReceiptFile($item);
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

    /**
     * Serves the receipt inline (not force-downloaded) so a browser tab shows
     * the image/PDF directly — that's the useful action for "let me quickly
     * check this receipt", vs. a forced download.
     */
    public function receipt(Request $request, $type, $id)
    {
        try {
            $model = $this->getModel($type);
            $item = $model::findOrFail($id);

            if (!$item->receipt_path || !Storage::disk('local')->exists($item->receipt_path)) {
                return response()->json(['message' => 'Receipt not found.'], 404);
            }

            return Storage::disk('local')->response(
                $item->receipt_path,
                $item->receipt_name,
                ['Content-Type' => $item->receipt_mime ?? 'application/octet-stream']
            );
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Financial record not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load receipt.'], 500);
        }
    }
}
