<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-set presence timestamp, never client-writable — feeds the chat
 * "online" / "last seen at HH:MM" fallback (see routes/channels.php's
 * chat.project.{id} presence channel for the live-online half of that UX).
 * Throttled to once per 60s per user so a chat-heavy session doesn't turn
 * this into a write on every single API request.
 */
class UpdateLastSeenAt
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && (!$user->last_seen_at || $user->last_seen_at->lt(now()->subSeconds(60)))) {
            DB::table('users')->where('id', $user->id)->update(['last_seen_at' => now()]);
        }

        return $next($request);
    }
}
