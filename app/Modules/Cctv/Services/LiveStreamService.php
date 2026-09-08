<?php

namespace App\Modules\Cctv\Services;

use App\Models\CameraChannel;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\Contracts\MediaMtxGatewayInterface;
use App\Modules\Cctv\Exceptions\DvrUnauthorizedException;
use App\Modules\Cctv\Exceptions\DvrUnreachableException;
use App\Modules\Cctv\Support\DahuaUrlBuilder;
use App\Modules\Cctv\Support\StreamPathNamer;
use App\Modules\Cctv\Support\StreamTokenService;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Carbon;

/**
 * Orchestrates turning a policy-checked camera into a watchable stream: builds
 * the RTSP source URL server-side only (never sent to the client), registers
 * it with MediaMTX on demand, mints a short-lived access token, and returns
 * only the public-facing WebRTC/HLS URLs — no IP, no RTSP URL, no credentials.
 * Also wraps the existing snapshot passthrough so both live-view and snapshot
 * requests opportunistically correct the camera's stored status (see
 * CameraChannelRepositoryInterface::markAllOfflineForDevice()'s docblock for
 * why this is the chosen way individual cameras self-correct back to online).
 */
final class LiveStreamService
{
    public function __construct(
        private readonly CameraChannelRepositoryInterface $cameras,
        private readonly DvrGatewayInterface $dvrGateway,
        private readonly MediaMtxGatewayInterface $mediaMtx,
        private readonly StreamTokenService $tokens,
        private readonly CameraLogRepositoryInterface $logs,
    ) {}

    /** @return array{webrtc_url:?string,hls_url:?string,expires_at:Carbon} */
    public function mintLiveStream(CameraChannel $camera, User $user, int $subtype): array
    {
        $device = $camera->device;
        $password = $this->resolvePasswordOrFail($device);

        $rtspUrl = DahuaUrlBuilder::rtsp($device, $camera->channel_number, $password, $subtype);
        $path = StreamPathNamer::forChannel($device->id, $camera->channel_number, $subtype);

        $mediaMtxOnline = true;
        try {
            $this->mediaMtx->registerPathIfMissing($path, $rtspUrl);
        } catch (\Throwable $e) {
            $mediaMtxOnline = false;
            \Illuminate\Support\Facades\Log::info("MediaMTX registration skipped for {$path}: " . $e->getMessage());
        }

        $minted = $this->tokens->mint($camera, $user, $subtype);

        // A successful mint means MediaMTX accepted the source and the DVR is
        // reachable enough to build a valid RTSP URL for — good opportunistic
        // signal the camera is alive, corrected lazily rather than via a
        // separate per-channel poll loop (see module health-monitoring design).
        $this->cameras->markStatus($camera, CameraChannel::STATUS_ONLINE);

        $this->logs->record(
            'camera.stream_requested',
            camera: $camera,
            device: $device,
            meta: ['subtype' => $subtype],
            userId: $user->id,
        );

        $webrtcBase = config('services.mediamtx.webrtc_url') ?: 'http://127.0.0.1:8889';
        $hlsBase = config('services.mediamtx.hls_url') ?: 'http://127.0.0.1:8888';

        return [
            // MediaMTX's WHEP (WebRTC) endpoint is POST {base}/{path}/whep — a
            // bare POST {base}/{path} 404s. Verified against a real running
            // MediaMTX v1.20.0 instance. HLS has no such suffix requirement;
            // GET {base}/{path} itself redirects to the right playlist.
            'webrtc_url' => $mediaMtxOnline ? $this->buildPlaybackUrl($webrtcBase, $minted, '/whep') : null,
            'hls_url' => $mediaMtxOnline ? $this->buildPlaybackUrl($hlsBase, $minted) : null,
            'mediamtx_online' => $mediaMtxOnline,
            'expires_at' => $minted['expires_at'],
        ];
    }

    public function snapshot(CameraChannel $camera): string
    {
        try {
            $bytes = $this->dvrGateway->fetchSnapshot($camera->device, $camera->channel_number);
        } catch (DvrUnreachableException|DvrUnauthorizedException $e) {
            $this->cameras->markStatus($camera, CameraChannel::STATUS_OFFLINE);

            throw $e;
        }

        $this->cameras->markStatus($camera, CameraChannel::STATUS_ONLINE);

        return $bytes;
    }

    private function resolvePasswordOrFail($device): string
    {
        try {
            return $device->plainPassword();
        } catch (DecryptException) {
            throw new DvrUnauthorizedException(
                'Stored credentials could not be decrypted (APP_KEY may have changed). Re-enter the device password.'
            );
        }
    }

    private function buildPlaybackUrl(?string $base, array $minted, string $suffix = ''): ?string
    {
        if (!$base) {
            return null;
        }

        return rtrim($base, '/') . '/' . $minted['path'] . $suffix . '?token=' . urlencode($minted['token']);
    }
}
