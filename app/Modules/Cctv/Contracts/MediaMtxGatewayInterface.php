<?php

namespace App\Modules\Cctv\Contracts;

/**
 * Talks to the MediaMTX streaming server's HTTP Control API to register RTSP
 * source paths for on-demand pulling. Swapped between MediaMtxHttpGateway
 * (live) and FakeMediaMtxGateway (CCTV_DRIVER=fake) by CctvServiceProvider —
 * the same driver flag already used for DvrGatewayInterface, not a second one.
 */
interface MediaMtxGatewayInterface
{
    /**
     * Ensures a path named $path exists on the MediaMTX server, pointing at
     * $rtspSourceUrl with on-demand pulling (MediaMTX only opens the real RTSP
     * session to the DVR once a viewer connects, and closes it after).
     *
     * Idempotent and version-agnostic: checks first (GET) rather than relying
     * on the add endpoint (POST) itself being a no-op on an existing path,
     * since that behavior differs across MediaMTX versions.
     *
     * @throws \App\Modules\Cctv\Exceptions\MediaMtxUnavailableException
     * @throws \App\Modules\Cctv\Exceptions\MediaMtxRejectedException
     */
    public function registerPathIfMissing(string $path, string $rtspSourceUrl): void;
}
