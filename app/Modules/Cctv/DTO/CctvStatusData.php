<?php

namespace App\Modules\Cctv\DTO;

/**
 * Aggregate counts for the /cctv/status endpoint and the Monitoring dashboard's
 * top-level summary tiles.
 */
final readonly class CctvStatusData
{
    public function __construct(
        public int $totalDevices,
        public int $onlineDevices,
        public int $offlineDevices,
        public int $unauthorizedDevices,
        public int $totalCameras,
        public int $onlineCameras,
        public int $offlineCameras,
    ) {}

    public function toArray(): array
    {
        return [
            'devices' => [
                'total' => $this->totalDevices,
                'online' => $this->onlineDevices,
                'offline' => $this->offlineDevices,
                'unauthorized' => $this->unauthorizedDevices,
            ],
            'cameras' => [
                'total' => $this->totalCameras,
                'online' => $this->onlineCameras,
                'offline' => $this->offlineCameras,
            ],
        ];
    }
}
