<?php

namespace Tests\Feature\Cctv;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Exercises the test-connection / view-channels / sync-cameras actions against
 * FakeDvrGateway (CCTV_DRIVER=fake, set in phpunit.xml) — no real hardware
 * reachable in CI or local dev. FakeDvrGateway mirrors the device's own stored
 * `status` field back as the probe result, so these tests drive it by setting
 * that field on the fixture.
 */
class DeviceProbeAndSyncTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_test_connection_reports_online_and_updates_device_status(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/cctv/devices/{$device->id}/test");

        $response->assertStatus(200)
            ->assertJsonPath('reachable', true)
            ->assertJsonPath('authorized', true)
            ->assertJsonPath('status', DvrDevice::STATUS_ONLINE);

        $this->assertDatabaseHas('camera_logs', ['event' => 'device.tested']);
    }

    public function test_test_connection_reports_unauthorized_for_bad_credentials(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_UNAUTHORIZED);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/cctv/devices/{$device->id}/test");

        $response->assertStatus(200)
            ->assertJsonPath('reachable', true)
            ->assertJsonPath('authorized', false)
            ->assertJsonPath('status', DvrDevice::STATUS_UNAUTHORIZED);
    }

    public function test_test_connection_reports_unreachable_when_offline(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_OFFLINE);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/cctv/devices/{$device->id}/test");

        $response->assertStatus(200)
            ->assertJsonPath('reachable', false)
            ->assertJsonPath('status', DvrDevice::STATUS_OFFLINE);
    }

    public function test_channels_endpoint_previews_without_persisting(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $device->update(['channel_count' => 4]);
        // No camera_channels rows created yet for this device (fixture only
        // makes one via makeProjectWithDevice — remove it to test a clean probe).
        CameraChannel::where('dvr_device_id', $device->id)->delete();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/v1/cctv/devices/{$device->id}/channels");

        $response->assertStatus(200)->assertJsonCount(4);
        $this->assertDatabaseCount('camera_channels', 0);
    }

    public function test_channels_endpoint_returns_unauthorized_error_code_for_bad_credentials(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_UNAUTHORIZED);

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/v1/cctv/devices/{$device->id}/channels");

        $response->assertStatus(502)->assertJsonPath('code', 'DEVICE_UNAUTHORIZED');
    }

    public function test_sync_creates_channels_matching_device_channel_count(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $device->update(['channel_count' => 8]);
        CameraChannel::where('dvr_device_id', $device->id)->delete();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/cctv/devices/{$device->id}/sync");

        $response->assertStatus(200)->assertJsonPath('created', 8);
        $this->assertDatabaseCount('camera_channels', 8);
        $this->assertDatabaseHas('activity_logs', ['entity' => 'DvrDevice']);
    }

    public function test_sync_deactivates_channels_no_longer_reported_by_the_device(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $device->update(['channel_count' => 2]);

        // A stray channel number the fake device will never report (fake gateway
        // only reports channels 1..channel_count).
        $stale = CameraChannel::factory()->create([
            'dvr_device_id' => $device->id,
            'channel_number' => 99,
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/cctv/devices/{$device->id}/sync");

        $response->assertStatus(200)->assertJsonPath('deactivated', 1);
        $this->assertFalse($stale->fresh()->is_active);
    }

    public function test_manager_cannot_test_or_sync_a_device(): void
    {
        [$project, $device] = $this->makeProjectWithDevice();
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->actingAs($manager, 'sanctum')
            ->postJson("/api/v1/cctv/devices/{$device->id}/test")
            ->assertStatus(403);

        $this->actingAs($manager, 'sanctum')
            ->postJson("/api/v1/cctv/devices/{$device->id}/sync")
            ->assertStatus(403);
    }
}
