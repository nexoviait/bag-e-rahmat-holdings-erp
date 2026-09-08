<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Modules\Cctv\Support\StreamTokenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Validates MediaMTX's authHTTPAddress webhook calls. This endpoint is NOT
 * behind Sanctum — MediaMTX isn't a logged-in user — so it's protected instead
 * by a shared secret baked into the webhook URL itself (the only mechanism
 * MediaMTX's webhook contract supports; see routes/api.php), plus route-level
 * throttling.
 *
 * MediaMTX calls this on every WHEP renegotiation and every HLS
 * segment/playlist fetch, including the client's own reconnect attempts — so
 * the token check here must stay TTL-only (see StreamTokenService), never
 * single-use, or auto-reconnect silently breaks.
 */
class MediaMtxAuthController extends CctvController
{
    public function __construct(private readonly StreamTokenService $tokens) {}

    public function __invoke(Request $request)
    {
        $secret = (string) config('services.mediamtx.auth_secret');

        // Fail closed if no secret is configured — an empty configured secret
        // must never be satisfied by an equally-empty/missing request param.
        if ($secret === '' || !hash_equals($secret, (string) $request->query('secret'))) {
            return response()->json(['message' => 'Invalid secret.'], 401);
        }

        $path = (string) $request->input('path');
        $token = $this->extractToken($request);

        if ($path === '' || $token === '' || !$this->tokens->validate($token, $path)) {
            Log::info('MediaMTX auth webhook denied a stream request', ['path' => $path]);

            return response()->json(['message' => 'Invalid or expired stream token.'], 401);
        }

        return response()->json(['message' => 'ok']);
    }

    private function extractToken(Request $request): string
    {
        if ($request->filled('token')) {
            return (string) $request->input('token');
        }

        // MediaMTX's webhook payload carries the original request's raw query
        // string in a `query` field rather than pre-parsed — parse it out.
        $query = (string) $request->input('query', '');
        parse_str($query, $parsed);

        return (string) ($parsed['token'] ?? '');
    }
}
