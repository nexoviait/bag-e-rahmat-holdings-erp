<?php

namespace App\Modules\Cctv\Services\Gateways;

use App\Modules\Cctv\Contracts\MediaMtxGatewayInterface;

/**
 * Deterministic stand-in for MediaMtxHttpGateway, bound when CCTV_DRIVER=fake
 * (see CctvServiceProvider) — no network I/O, no MediaMTX instance required.
 * Always succeeds, so every caller (LiveStreamService, StreamController) can be
 * exercised end-to-end in this sandbox exactly as it would run against a real,
 * reachable MediaMTX server. Error-path behavior (MediaMtxUnavailable/Rejected)
 * is exercised in tests via a purpose-built double, not by branching this class.
 */
final class FakeMediaMtxGateway implements MediaMtxGatewayInterface
{
    public function registerPathIfMissing(string $path, string $rtspSourceUrl): void
    {
        // No-op — deterministic success, mirrors "MediaMTX already had (or
        // happily accepted) this path" without any real server to check against.
    }
}
