<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class DocumentTypeController extends Controller
{
    public function index()
    {
        try {
            return response()->json(DocumentType::orderBy('name')->get(['id', 'name']));
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to load document types.'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:100'],
            ]);

            $name = trim($validated['name']);

            $duplicate = DocumentType::whereRaw('LOWER(name) = ?', [Str::lower($name)])->exists();
            if ($duplicate) {
                throw ValidationException::withMessages([
                    'name' => ['This document type already exists.'],
                ]);
            }

            $type = DocumentType::create(['name' => $name]);

            return response()->json($type, 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json(['message' => 'Failed to create document type.'], 500);
        }
    }
}
