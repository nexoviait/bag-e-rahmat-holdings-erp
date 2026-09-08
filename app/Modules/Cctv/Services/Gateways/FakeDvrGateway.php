<?php

namespace App\Modules\Cctv\Services\Gateways;

use App\Models\DvrDevice;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\DTO\DeviceProbeResultData;
use App\Modules\Cctv\DTO\DiscoveredChannelData;
use App\Modules\Cctv\Exceptions\DvrUnauthorizedException;
use App\Modules\Cctv\Exceptions\DvrUnreachableException;

/**
 * Deterministic stand-in for DahuaHttpGateway, bound when CCTV_DRIVER=fake (see
 * CctvServiceProvider). No network I/O — mirrors the device's own stored `status`
 * field back as the probe result, so seeded fixtures (CctvDemoSeeder) drive
 * predictable, repeatable behaviour for tests and browser demos without any
 * real hardware reachable. Satisfies the exact same interface the live Dahua
 * gateway does, so callers cannot tell which is bound.
 */
final class FakeDvrGateway implements DvrGatewayInterface
{
    public function testConnection(DvrDevice $device): DeviceProbeResultData
    {
        return match ($device->status) {
            DvrDevice::STATUS_UNAUTHORIZED => DeviceProbeResultData::unauthorized(
                'The recorder rejected the saved username or password.'
            ),
            DvrDevice::STATUS_OFFLINE => DeviceProbeResultData::unreachable(
                "Cannot reach the recorder at {$device->ip_address}. Check that it's powered on and reachable from the server network."
            ),
            default => DeviceProbeResultData::success('NVR', $device->serial_number),
        };
    }

    public function discoverChannels(DvrDevice $device): array
    {
        if ($device->status === DvrDevice::STATUS_UNAUTHORIZED) {
            throw new DvrUnauthorizedException();
        }
        if ($device->status === DvrDevice::STATUS_OFFLINE) {
            throw new DvrUnreachableException();
        }

        $channels = [];
        for ($n = 1; $n <= $device->channel_count; $n++) {
            $channels[] = new DiscoveredChannelData(channelNumber: $n, name: "Camera {$n}");
        }

        return $channels;
    }

    public function fetchSnapshot(DvrDevice $device, int $channelNumber): string
    {
        if ($device->status === DvrDevice::STATUS_UNAUTHORIZED) {
            throw new DvrUnauthorizedException();
        }
        if ($device->status === DvrDevice::STATUS_OFFLINE) {
            throw new DvrUnreachableException();
        }

        return $this->generateJpegSnapshot($channelNumber, $device->device_name ?? 'DVR Recorder');
    }

    private function generateJpegSnapshot(int $channelNumber, string $deviceName): string
    {
        if (!function_exists('imagecreatetruecolor')) {
            return base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=');
        }

        $im = imagecreatetruecolor(640, 360);
        $bg = imagecolorallocate($im, 15, 23, 42); // slate-900
        $gridColor = imagecolorallocate($im, 30, 41, 59); // slate-800
        $textColor = imagecolorallocate($im, 226, 232, 240); // slate-200
        $timeColor = imagecolorallocate($im, 56, 189, 248); // sky-400
        $liveColor = imagecolorallocate($im, 34, 197, 94); // green-500
        $goldColor = imagecolorallocate($im, 212, 175, 55); // gold

        imagefill($im, 0, 0, $bg);

        // Draw HUD grid
        imageline($im, 0, 180, 640, 180, $gridColor);
        imageline($im, 320, 0, 320, 360, $gridColor);
        imageellipse($im, 320, 180, 160, 160, $gridColor);
        imagefilledellipse($im, 320, 180, 8, 8, $goldColor);

        // Draw camera info text
        $title = sprintf("CH.%02d - %s", $channelNumber, $deviceName);
        $time = date('Y-m-d H:i:s');
        imagestring($im, 4, 20, 20, $title, $textColor);
        imagestring($im, 4, 440, 20, $time, $timeColor);
        imagefilledellipse($im, 30, 330, 12, 12, $liveColor);
        imagestring($im, 3, 45, 323, "LIVE CAM " . $channelNumber, $liveColor);

        ob_start();
        imagejpeg($im, null, 85);
        $jpegData = ob_get_clean();
        imagedestroy($im);

        return $jpegData;
    }
}
