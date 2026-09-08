<?php

namespace App\Notifications;

use App\Models\DvrDevice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Fired by PollCctvHealth when a DVR device transitions INTO offline/
 * unauthorized (not on every poll — only the transition, so a permanently-down
 * device doesn't re-notify every 5 minutes; see PollCctvHealth).
 *
 * Deliberately built from plain scalars rather than the DvrDevice model itself:
 * this keeps the queued/serialized payload minimal and guarantees the device's
 * ip_address/username/password can never end up in it by accident. The
 * `database` channel's payload is eventually serialized straight to the
 * frontend via NotificationController — it must hold to the same "never
 * expose internal infrastructure details to the client" rule as every other
 * CCTV API response.
 */
class DvrDeviceOfflineNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly int $deviceId,
        private readonly string $deviceName,
        private readonly ?int $projectId,
        private readonly ?string $projectName,
        private readonly string $status,
    ) {}

    public static function forDevice(DvrDevice $device): self
    {
        return new self(
            deviceId: $device->id,
            deviceName: $device->device_name,
            projectId: $device->project_id,
            projectName: $device->project?->name,
            status: $device->status,
        );
    }

    /** @return array<int,string> */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'device_id' => $this->deviceId,
            'device_name' => $this->deviceName,
            'project_id' => $this->projectId,
            'project_name' => $this->projectName,
            'status' => $this->status,
            'message' => $this->message(),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject("CCTV recorder \"{$this->deviceName}\" is offline")
            ->line($this->message())
            ->line('Check the device\'s power and network connection, then use "Test Connection" in the CCTV tab to confirm it has recovered.');
    }

    private function message(): string
    {
        $where = $this->projectName ? " ({$this->projectName})" : '';
        $verb = $this->status === DvrDevice::STATUS_UNAUTHORIZED
            ? 'is rejecting its saved credentials'
            : 'has gone offline';

        return "DVR recorder \"{$this->deviceName}\"{$where} {$verb}.";
    }
}
