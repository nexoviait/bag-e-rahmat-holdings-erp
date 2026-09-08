<?php

namespace App\Modules\Cctv\Support;

use App\Models\CameraChannel;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Mints and validates short-lived opaque tokens that authorize a single
 * MediaMTX stream connection, without ever handing the client the DVR's RTSP
 * URL or credentials. Backed by Laravel's Cache (no new table — these are
 * intentionally ephemeral) rather than a signed JWT, since the only thing that
 * needs to validate a token is this same app (via MediaMTX's auth webhook),
 * not a third party.
 *
 * TTL-only, never consumed on first check: MediaMTX's authHTTPAddress webhook
 * fires on every WHEP renegotiation and every HLS segment/playlist fetch,
 * including the client's own reconnect attempts — a single-use token would
 * silently break auto-reconnect the first time a viewer's connection blips.
 */
final class StreamTokenService
{
    private const TTL_SECONDS = 120;

    /** @return array{token:string,path:string,expires_at:Carbon} */
    public function mint(CameraChannel $camera, User $user, int $subtype): array
    {
        $token = Str::random(40);
        $path = StreamPathNamer::forChannel($camera->dvr_device_id, $camera->channel_number, $subtype);
        $expiresAt = now()->addSeconds(self::TTL_SECONDS);

        Cache::put($this->cacheKey($token), [
            'camera_id' => $camera->id,
            'user_id' => $user->id,
            'path' => $path,
        ], $expiresAt);

        return ['token' => $token, 'path' => $path, 'expires_at' => $expiresAt];
    }

    /**
     * Validates that $token is unexpired and was minted for exactly $path —
     * defends against replaying a token minted for camera A's path against
     * camera B's. Does NOT delete the cache entry: see class docblock.
     */
    public function validate(string $token, string $path): bool
    {
        $entry = Cache::get($this->cacheKey($token));

        return $entry !== null && ($entry['path'] ?? null) === $path;
    }

    private function cacheKey(string $token): string
    {
        return "cctv:stream-token:{$token}";
    }
}
