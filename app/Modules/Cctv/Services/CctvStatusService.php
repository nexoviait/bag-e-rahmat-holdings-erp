<?php

namespace App\Modules\Cctv\Services;

use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use App\Modules\Cctv\DTO\CctvStatusData;

final class CctvStatusService
{
    public function __construct(
        private readonly DvrDeviceRepositoryInterface $devices,
        private readonly CameraChannelRepositoryInterface $cameras,
    ) {}

    public function statusFor(User $user): CctvStatusData
    {
        $devices = $this->devices->listVisibleTo($user);
        $cameraCounts = $this->cameras->statusCountsFor($user);

        return new CctvStatusData(
            totalDevices: $devices->count(),
            onlineDevices: $devices->where('status', DvrDevice::STATUS_ONLINE)->count(),
            offlineDevices: $devices->where('status', DvrDevice::STATUS_OFFLINE)->count(),
            unauthorizedDevices: $devices->where('status', DvrDevice::STATUS_UNAUTHORIZED)->count(),
            totalCameras: $cameraCounts['total'],
            onlineCameras: $cameraCounts['online'],
            offlineCameras: $cameraCounts['offline'],
        );
    }
}
