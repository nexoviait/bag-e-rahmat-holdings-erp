<?php

namespace App\Modules\Cctv\DTO;

/**
 * One channel as reported by the physical DVR during discovery/sync — distinct
 * from the CameraChannel Eloquent model, which is the locally-persisted record.
 */
final readonly class DiscoveredChannelData
{
    public function __construct(
        public int $channelNumber,
        public string $name,
    ) {}
}
