<?php

namespace App\Modules\Cctv\Contracts;

use App\Models\DvrDevice;
use App\Modules\Cctv\DTO\DeviceProbeResultData;
use App\Modules\Cctv\DTO\DiscoveredChannelData;

/**
 * Talks to the physical DVR/XVR over its HTTP CGI API. Swapped between
 * DahuaHttpGateway (live) and FakeDvrGateway (CCTV_DRIVER=fake) by
 * CctvServiceProvider — every caller depends on this interface, never the
 * concrete implementation, so Services/Controllers work identically against
 * either.
 */
interface DvrGatewayInterface
{
    /**
     * Probes the device: reachability + credential check. Never throws —
     * failures are reported via the returned DTO so callers can decide how
     * to react (e.g. update device.status vs. bubble up as an HTTP error).
     */
    public function testConnection(DvrDevice $device): DeviceProbeResultData;

    /**
     * Enumerates channels as currently configured on the physical device.
     *
     * @return DiscoveredChannelData[]
     * @throws \App\Modules\Cctv\Exceptions\DvrUnreachableException
     * @throws \App\Modules\Cctv\Exceptions\DvrUnauthorizedException
     */
    public function discoverChannels(DvrDevice $device): array;

    /**
     * Fetches a single JPEG snapshot frame for one channel.
     *
     * @return string raw JPEG bytes
     * @throws \App\Modules\Cctv\Exceptions\DvrUnreachableException
     * @throws \App\Modules\Cctv\Exceptions\DvrUnauthorizedException
     */
    public function fetchSnapshot(DvrDevice $device, int $channelNumber): string;
}
