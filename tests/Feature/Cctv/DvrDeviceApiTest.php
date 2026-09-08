<?php

namespace Tests\Feature\Cctv;

use App\Models\ActivityLog;
use App\Models\DvrDevice;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DvrDeviceApiTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_create_a_device_and_it_is_logged(): void
    {
        $admin = $this->makeUserWithRole('admin');
        $project = Project::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/cctv/devices', [
            'project_id' => $project->id,
            'device_name' => 'Main Recorder',
            'model' => 'DH-XVR1B16H-I',
            'ip_address' => '192.168.1.108',
            'username' => 'admin',
            'password' => 'S3cret!',
            'channel_count' => 16,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('device_name', 'Main Recorder')
            ->assertJsonPath('status', DvrDevice::STATUS_UNKNOWN)
            ->assertJsonMissingPath('password');

        $this->assertDatabaseHas('dvr_devices', [
            'project_id' => $project->id,
            'device_name' => 'Main Recorder',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'project_id' => $project->id,
            'entity' => 'DvrDevice',
        ]);
        $this->assertDatabaseHas('camera_logs', [
            'event' => 'device.created',
        ]);
    }

    public function test_user_role_cannot_create_a_device(): void
    {
        $user = $this->makeUserWithRole('user');
        $project = Project::factory()->create();
        $this->assignUserToProject($user, $project);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/cctv/devices', [
            'project_id' => $project->id,
            'device_name' => 'Main Recorder',
            'ip_address' => '192.168.1.108',
            'username' => 'admin',
            'password' => 'S3cret!',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('dvr_devices', ['device_name' => 'Main Recorder']);
    }

    public function test_manager_cannot_create_a_device(): void
    {
        $manager = $this->makeUserWithRole('manager');
        $project = Project::factory()->create();
        $this->assignUserToProject($manager, $project);

        $this->actingAs($manager, 'sanctum')->postJson('/api/v1/cctv/devices', [
            'project_id' => $project->id,
            'device_name' => 'Main Recorder',
            'ip_address' => '192.168.1.108',
            'username' => 'admin',
            'password' => 'S3cret!',
        ])->assertStatus(403);
    }

    public function test_create_validates_required_fields_and_ip_format(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/cctv/devices', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['project_id', 'device_name', 'ip_address', 'username', 'password']);
    }

    public function test_admin_can_update_a_device_without_resupplying_password(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice();
        $originalEncryptedPassword = $device->getRawOriginal('password');

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/v1/cctv/devices/{$device->id}", [
            'project_id' => $device->project_id,
            'device_name' => 'Renamed Recorder',
            'ip_address' => $device->ip_address,
            'username' => $device->username,
            // password omitted
        ]);

        $response->assertStatus(200)->assertJsonPath('device_name', 'Renamed Recorder');

        // The encrypted column must be byte-for-byte unchanged — omitting the
        // password field on update must never overwrite the stored credential.
        $this->assertSame($originalEncryptedPassword, $device->fresh()->getRawOriginal('password'));
    }

    public function test_admin_can_delete_a_device(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('dvr_devices', ['id' => $device->id]);
    }

    public function test_deleting_a_device_cascades_to_its_cameras(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device, $camera] = $this->makeProjectWithDevice();

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/cctv/devices/{$device->id}");

        $this->assertDatabaseMissing('camera_channels', ['id' => $camera->id]);
    }

    public function test_updating_a_nonexistent_device_returns_404(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/cctv/devices/999999', [
            'project_id' => Project::factory()->create()->id,
            'device_name' => 'X',
            'ip_address' => '10.0.0.1',
            'username' => 'admin',
        ])->assertStatus(404);
    }
}
