<?php

namespace App\Modules\Cctv\Contracts;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\DTO\CameraChannelData;
use App\Modules\Cctv\DTO\CameraFilterData;
use App\Modules\Cctv\DTO\SyncResultData;
use Illuminate\Database\Eloquent\Collection;

interface CameraChannelRepositoryInterface
{
    public function findWithDeviceOrFail(int $id): CameraChannel;

    /**
     * The single authoritative visibility-scoped query: admins see everything;
     * everyone else sees only cameras on devices in their assigned projects,
     * further filtered by the device's visibility mode (all/specific/admin_only).
     *
     * @return Collection<int, CameraChannel>
     */
    public function listVisibleTo(User $user, CameraFilterData $filter): Collection;

    /** @return array{online:int,offline:int,unknown:int,total:int} */
    public function statusCountsFor(User $user): array;

    public function update(CameraChannel $camera, CameraChannelData $data): CameraChannel;

    public function markStatus(CameraChannel $camera, string $status): CameraChannel;

    /**
     * Bulk-marks every active camera on $device as offline — used when the
     * device itself goes unreachable/unauthorized, since every channel behind
     * it genuinely is unreachable too. One-directional: coming back online does
     * NOT cascade cameras back to online (see PollCctvHealth) — only HTTP/auth
     * to the recorder is confirmed at that point, not that each RTSP channel is
     * actually streaming, so cameras self-correct opportunistically instead.
     */
    public function markAllOfflineForDevice(DvrDevice $device): void;

    /**
     * Reconciles locally-stored channels against what the device just reported:
     * creates missing ones, updates renamed ones, deactivates ones no longer
     * present on the device (never hard-deletes — preserves camera_logs history).
     *
     * @param \App\Modules\Cctv\DTO\DiscoveredChannelData[] $discovered
     */
    public function upsertFromSync(DvrDevice $device, array $discovered): SyncResultData;
}
