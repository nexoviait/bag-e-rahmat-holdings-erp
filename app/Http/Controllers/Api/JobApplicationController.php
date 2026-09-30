<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobApplication;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Company-wide job applications — not tied to any project, unlike Share
 * Transfer/Sell/NOC. Any logged-in user can apply; admins review from the
 * global admin Job Applications page.
 */
class JobApplicationController extends Controller
{
    private const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
    private const MAX_FILE_KB = 20480;

    private function present(JobApplication $a): array
    {
        return [
            'id' => $a->id,
            'applicant_id' => $a->applicant_id,
            'applicant_name' => $a->applicant?->name,
            'applicant_email' => $a->applicant?->email,
            'applicant_phone' => $a->applicant?->phone,
            'position' => $a->position,
            'cover_note' => $a->cover_note,
            'cv_name' => $a->cv_name,
            'photo_name' => $a->photo_name,
            'certificate_name' => $a->certificate_name,
            'status' => $a->status,
            'admin_notes' => $a->admin_notes,
            'reviewed_by' => $a->reviewer?->name,
            'reviewed_at' => $a->reviewed_at,
            'created_at' => $a->created_at,
        ];
    }

    public function index(Request $request)
    {
        try {
            $user = $request->user();

            if ($user->hasAnyRole(['super_admin', 'admin'])) {
                $items = JobApplication::with(['applicant', 'reviewer'])->orderBy('created_at', 'desc')->get();
            } else {
                if (!$user->can('job_applications.view')) {
                    return response()->json(['message' => 'Your role does not have permission to view job applications.'], 403);
                }
                $items = JobApplication::where('applicant_id', $user->id)
                    ->with(['applicant', 'reviewer'])
                    ->orderBy('created_at', 'desc')
                    ->get();
            }

            return response()->json($items->map(fn ($a) => $this->present($a)));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load job applications.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->can('job_applications.create')) {
                return response()->json(['message' => 'Your role does not have permission to apply.'], 403);
            }

            $validated = $request->validate([
                'position' => 'required|string|max:255',
                'cover_note' => 'nullable|string',
                'cv' => 'required|file|max:' . self::MAX_FILE_KB,
                'photo' => 'required|file|max:' . self::MAX_FILE_KB,
                'certificate' => 'nullable|file|max:' . self::MAX_FILE_KB,
            ]);

            foreach (['cv', 'photo', 'certificate'] as $field) {
                if (!$request->hasFile($field)) {
                    continue;
                }
                $ext = strtolower($request->file($field)->getClientOriginalExtension());
                if (!in_array($ext, self::DOC_EXTENSIONS, true)) {
                    throw ValidationException::withMessages([
                        $field => ["Unsupported file type for {$field}. Allowed: " . implode(', ', self::DOC_EXTENSIONS) . '.'],
                    ]);
                }
            }

            $cvFile = $request->file('cv');
            $cvPath = $cvFile->storeAs('job-applications/' . $user->id, Str::uuid() . '.' . $cvFile->getClientOriginalExtension(), 'local');

            $photoFile = $request->file('photo');
            $photoPath = $photoFile->storeAs('job-applications/' . $user->id, Str::uuid() . '.' . $photoFile->getClientOriginalExtension(), 'local');

            $certPath = null;
            $certName = null;
            if ($request->hasFile('certificate')) {
                $certFile = $request->file('certificate');
                $certPath = $certFile->storeAs('job-applications/' . $user->id, Str::uuid() . '.' . $certFile->getClientOriginalExtension(), 'local');
                $certName = $certFile->getClientOriginalName();
            }

            $item = JobApplication::create([
                'applicant_id' => $user->id,
                'position' => $validated['position'],
                'cover_note' => $validated['cover_note'] ?? null,
                'cv_path' => $cvPath,
                'cv_name' => $cvFile->getClientOriginalName(),
                'photo_path' => $photoPath,
                'photo_name' => $photoFile->getClientOriginalName(),
                'certificate_path' => $certPath,
                'certificate_name' => $certName,
                'status' => 'pending',
            ]);
            $item->load('applicant');

            return response()->json($this->present($item), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to submit application.'], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        try {
            if (!$request->user()->can('job_applications.review')) {
                return response()->json(['message' => 'Your role does not have permission to review job applications.'], 403);
            }

            $item = JobApplication::findOrFail($id);

            $validated = $request->validate([
                'status' => 'required|in:pending,shortlisted,approved,rejected',
                'admin_notes' => 'nullable|string',
            ]);

            $item->update([
                'status' => $validated['status'],
                'admin_notes' => $validated['admin_notes'] ?? $item->admin_notes,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
            $item->load(['applicant', 'reviewer']);

            return response()->json($this->present($item));
        } catch (ValidationException $e) {
            throw $e;
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Application not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to update application.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $item = JobApplication::findOrFail($id);
            $user = $request->user();

            if (!$user->can('job_applications.delete') && (int) $item->applicant_id !== (int) $user->id) {
                return response()->json(['message' => 'You can only delete applications you submitted yourself.'], 403);
            }

            foreach ([$item->cv_path, $item->photo_path, $item->certificate_path] as $path) {
                if ($path && Storage::disk('local')->exists($path)) {
                    Storage::disk('local')->delete($path);
                }
            }
            $item->delete();

            return response()->json(['message' => 'Application deleted successfully']);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Application not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to delete application.'], 500);
        }
    }

    private function downloadFile(Request $request, $id, string $pathField, string $nameField)
    {
        $item = JobApplication::findOrFail($id);
        $user = $request->user();

        if (!$user->hasAnyRole(['super_admin', 'admin']) && (int) $item->applicant_id !== (int) $user->id) {
            return response()->json(['message' => 'You do not have access to this file.'], 403);
        }

        if (!$item->{$pathField} || !Storage::disk('local')->exists($item->{$pathField})) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('local')->response($item->{$pathField}, $item->{$nameField});
    }

    public function cv(Request $request, $id)
    {
        try {
            return $this->downloadFile($request, $id, 'cv_path', 'cv_name');
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Application not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load file.'], 500);
        }
    }

    public function photo(Request $request, $id)
    {
        try {
            return $this->downloadFile($request, $id, 'photo_path', 'photo_name');
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Application not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load file.'], 500);
        }
    }

    public function certificate(Request $request, $id)
    {
        try {
            return $this->downloadFile($request, $id, 'certificate_path', 'certificate_name');
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Application not found.'], 404);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load file.'], 500);
        }
    }
}
