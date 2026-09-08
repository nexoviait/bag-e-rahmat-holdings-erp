<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cctv\Exceptions\CctvException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

/**
 * Module-local base controller. The shared app\Http\Controllers\Controller is a
 * bare abstract class with no AuthorizesRequests trait (Laravel 12's skeleton
 * dropped it) — $this->authorize() would fatal without adding it here. Kept
 * scoped to this module rather than touching the shared base class.
 */
abstract class CctvController extends Controller
{
    use AuthorizesRequests;

    /**
     * Translates a typed CctvException into the {message, code} shape every
     * CCTV endpoint returns on failure, so the frontend can render the right
     * friendly message per failure mode instead of pattern-matching on text.
     */
    protected function errorResponse(CctvException $e): JsonResponse
    {
        return response()->json([
            'message' => $e->userMessage(),
            'code' => $e->errorCode()->value,
        ], $e->httpStatus());
    }
}
