<?php

namespace App\Modules\Cctv\DTO;

/**
 * Outcome of syncing a device's channels against what the physical DVR reports —
 * returned by CameraChannelService::syncFromDevice() and surfaced to the "Sync
 * Cameras" button so the admin sees exactly what changed.
 */
final readonly class SyncResultData
{
    public function __construct(
        public int $created,
        public int $updated,
        public int $deactivated,
    ) {}

    public function toArray(): array
    {
        return [
            'created' => $this->created,
            'updated' => $this->updated,
            'deactivated' => $this->deactivated,
        ];
    }
}
