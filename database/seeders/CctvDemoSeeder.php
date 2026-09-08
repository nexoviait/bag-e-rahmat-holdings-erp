<?php

namespace Database\Seeders;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds realistic CCTV fixture data — a healthy device and a problem device,
 * each with a mix of camera statuses — so later phases (backend API, MediaMTX
 * integration, frontend) have something concrete to build and demo against
 * without needing real Dahua hardware reachable.
 */
class CctvDemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@brahmatholdings.com')->first();

        $siteA = Project::firstOrCreate(
            ['code' => 'CCTV-DEMO-A'],
            [
                'name' => 'Darul Aman Tower — CCTV Demo',
                'description' => 'Demo project for CCTV monitoring module fixtures.',
                'status' => 'active',
                'total_shareholder_project_price' => 0,
                'total_shareholders' => 0,
                'created_by' => $admin?->id,
            ]
        );

        $siteB = Project::firstOrCreate(
            ['code' => 'CCTV-DEMO-B'],
            [
                'name' => 'Riverside Complex — CCTV Demo',
                'description' => 'Second demo project for CCTV monitoring module fixtures.',
                'status' => 'active',
                'total_shareholder_project_price' => 0,
                'total_shareholders' => 0,
                'created_by' => $admin?->id,
            ]
        );

        // Also seed to first real project if available
        $realProject = Project::whereNotIn('code', ['CCTV-DEMO-A', 'CCTV-DEMO-B'])->first() ?? $siteA;

        // Live DVR Device (Serial: 8L05C0APAZ9DC84, Password: CCTV@2026)
        $deviceA = DvrDevice::updateOrCreate(
            ['project_id' => $realProject->id, 'ip_address' => '8L05C0APAZ9DC84', 'http_port' => 80],
            [
                'device_name' => 'Main Dahua Recorder',
                'brand' => 'Dahua',
                'model' => 'DH-XVR1B16H-I',
                'rtsp_port' => 554,
                'username' => 'admin',
                'password' => 'CCTV@2026',
                'serial_number' => '8L05C0APAZ9DC84',
                'channel_count' => 16,
                'visibility' => DvrDevice::VISIBILITY_ALL,
                'status' => DvrDevice::STATUS_ONLINE,
                'last_seen_at' => now(),
                'last_error' => null,
                'is_active' => true,
                'created_by' => $admin?->id,
            ]
        );

        $this->seedChannels($deviceA, offlineChannels: [5, 12]);

        // Device B: credentials were changed on the recorder without updating this
        // record — the "wrong credentials" error state — so every channel is unknown.
        $deviceB = DvrDevice::updateOrCreate(
            ['project_id' => $siteB->id, 'device_name' => 'Gate Recorder'],
            [
                'brand' => 'Dahua',
                'model' => 'DH-XVR1B16H-I',
                'ip_address' => '192.168.20.108',
                'http_port' => 80,
                'rtsp_port' => 554,
                'username' => 'admin',
                'password' => 'demo-password-stale',
                'serial_number' => 'DEMOB0000002',
                'channel_count' => 16,
                'visibility' => DvrDevice::VISIBILITY_ADMIN_ONLY,
                'status' => DvrDevice::STATUS_UNAUTHORIZED,
                'last_error' => 'The recorder rejected the saved username or password.',
                'is_active' => true,
                'created_by' => $admin?->id,
            ]
        );

        $this->seedChannels($deviceB, offlineChannels: range(1, 16), defaultStatus: CameraChannel::STATUS_UNKNOWN);
    }

    private function seedChannels(DvrDevice $device, array $offlineChannels = [], string $defaultStatus = CameraChannel::STATUS_ONLINE): void
    {
        for ($n = 1; $n <= $device->channel_count; $n++) {
            $status = in_array($n, $offlineChannels, true) ? CameraChannel::STATUS_OFFLINE : $defaultStatus;

            CameraChannel::updateOrCreate(
                ['dvr_device_id' => $device->id, 'channel_number' => $n],
                [
                    'camera_name' => "Camera {$n}",
                    'location' => null,
                    'stream_path' => "dvr{$device->id}-ch{$n}",
                    'stream_subtype' => CameraChannel::QUALITY_SUB,
                    'status' => $status,
                    'last_seen_at' => $status === CameraChannel::STATUS_ONLINE ? now() : null,
                    'is_active' => true,
                ]
            );
        }
    }
}
