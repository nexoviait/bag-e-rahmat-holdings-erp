<?php

namespace App\Console\Commands;

use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use App\Modules\Cctv\Services\DvrDeviceService;
use App\Modules\Cctv\Support\CctvPermission;
use App\Notifications\DvrDeviceOfflineNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Probes every active DVR device (reusing the exact same DvrDeviceService::
 * testConnection() the manual "Test Connection" button calls) and detects a
 * transition INTO offline/unauthorized by comparing status before/after the
 * call. Only the transition notifies — not every poll — so a recorder that's
 * been down for days doesn't re-notify its project every 5 minutes.
 *
 * Cascade is one-directional: going offline marks all the device's cameras
 * offline too (every channel behind an unreachable recorder genuinely is
 * unreachable), but coming back online does NOT cascade cameras back to
 * online — only HTTP/auth to the recorder is confirmed at that point, not
 * that each RTSP channel is actually streaming. Cameras self-correct
 * opportunistically instead, via markStatus() calls wired into the live/
 * snapshot endpoints as each is actually viewed (see LiveStreamService).
 */
class PollCctvHealth extends Command
{
    protected $signature = 'cctv:poll-health';

    protected $description = 'Probes every active CCTV DVR device, updates its status, and notifies project members when one goes offline or unauthorized.';

    public function __construct(
        private readonly DvrDeviceService $devices,
        private readonly DvrDeviceRepositoryInterface $deviceRepo,
        private readonly CameraChannelRepositoryInterface $cameras,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $devices = DvrDevice::where('is_active', true)->with('project')->get();
        $transitioned = 0;

        foreach ($devices as $device) {
            $previousStatus = $device->status;

            // Mutates $device in place (status/last_seen_at/last_error) via
            // updateStatus() — see DvrDeviceService::testConnection()'s docblock.
            $this->devices->testConnection($device, null);

            $wentDown = !$this->isDown($previousStatus) && $this->isDown($device->status);

            if ($wentDown) {
                $transitioned++;
                $this->cameras->markAllOfflineForDevice($device);
                $this->notifyProjectMembers($device);
            }
        }

        $this->info("Polled {$devices->count()} device(s), {$transitioned} newly down.");

        return self::SUCCESS;
    }

    private function isDown(string $status): bool
    {
        return in_array($status, [DvrDevice::STATUS_OFFLINE, DvrDevice::STATUS_UNAUTHORIZED], true);
    }

    private function notifyProjectMembers(DvrDevice $device): void
    {
        $memberIds = $this->deviceRepo->projectMemberIds($device);

        if ($memberIds === []) {
            return;
        }

        $recipients = User::whereIn('id', $memberIds)
            ->get()
            ->filter(fn (User $u) => $u->can(CctvPermission::DEVICES_VIEW));

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, DvrDeviceOfflineNotification::forDevice($device));
    }
}
