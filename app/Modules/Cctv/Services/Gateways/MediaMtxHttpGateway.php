<?php

namespace App\Modules\Cctv\Services\Gateways;

use App\Modules\Cctv\Contracts\MediaMtxGatewayInterface;
use App\Modules\Cctv\Exceptions\MediaMtxRejectedException;
use App\Modules\Cctv\Exceptions\MediaMtxUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Live implementation of MediaMtxGatewayInterface — talks to a real MediaMTX
 * server's HTTP Control API (v3 by default). Registers dynamic, on-demand
 * paths rather than generating static YAML, so adding one camera's path never
 * requires restarting MediaMTX (which would drop every other camera's viewers).
 *
 * Idempotency is implemented as GET-then-POST (check first) rather than relying
 * on the add endpoint itself being a no-op for an existing path — that behavior
 * differs across MediaMTX versions, while GET /config/paths/get/{name} returning
 * 404-vs-200 is stable across versions.
 */
final class MediaMtxHttpGateway implements MediaMtxGatewayInterface
{
    public function registerPathIfMissing(string $path, string $rtspSourceUrl): void
    {
        $client = $this->client();
        $base = $this->baseUrl();

        try {
            $existing = $client->get("{$base}/config/paths/get/{$path}");
        } catch (ConnectionException $e) {
            throw new MediaMtxUnavailableException(previous: $e);
        }

        if ($existing->successful()) {
            // Path already registered — nothing to do (idempotent no-op).
            return;
        }

        if ($existing->status() !== 404) {
            Log::warning('MediaMTX path lookup returned an unexpected status', [
                'path' => $path,
                'status' => $existing->status(),
            ]);

            throw new MediaMtxRejectedException(
                "The streaming server responded unexpectedly (HTTP {$existing->status()}) while checking the stream path."
            );
        }

        try {
            $created = $client->post("{$base}/config/paths/add/{$path}", [
                'source' => $rtspSourceUrl,
                'sourceOnDemand' => true,
            ]);
        } catch (ConnectionException $e) {
            throw new MediaMtxUnavailableException(previous: $e);
        }

        if ($created->failed()) {
            Log::warning('MediaMTX rejected path registration', [
                'path' => $path,
                'status' => $created->status(),
            ]);

            throw new MediaMtxRejectedException(
                "The streaming server rejected the stream path (HTTP {$created->status()})."
            );
        }
    }

    private function client()
    {
        $http = Http::connectTimeout(3)->timeout((int) config('services.mediamtx.timeout', 5));

        $user = config('services.mediamtx.api_user');
        $pass = config('services.mediamtx.api_pass');

        if ($user) {
            $http = $http->withBasicAuth($user, $pass ?? '');
        }

        return $http;
    }

    private function baseUrl(): string
    {
        $apiUrl = rtrim((string) config('services.mediamtx.api_url'), '/');
        $version = config('services.mediamtx.api_version', 'v3');

        return "{$apiUrl}/{$version}";
    }
}
