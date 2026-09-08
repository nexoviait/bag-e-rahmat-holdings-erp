<?php

namespace Tests\Feature\Cctv;

use App\Models\DvrDevice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mirrors CameraAccessControlTest's 4-role x 3-visibility matrix for the new
 * /cctv/live/{id} (mint) and /cctv/snapshot/{id} endpoints — stream() composes
 * the SNAPSHOT permission with the exact same view() visibility algorithm, so
 * the same scenarios must hold here too.
 */
class LiveStreamAccessTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config([
            'services.mediamtx.webrtc_url' => 'https://mtx.example.test/webrtc',
            'services.mediamtx.hls_url' => 'https://mtx.example.test/hls',
        ]);
    }

    public function test_super_admin_can_mint_and_snapshot_any_camera_regardless_of_visibility(): void
    {
        [, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $superAdmin = $this->makeUserWithRole('super_admin');

        $this->actingAs($superAdmin, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(200)
            ->assertJsonStructure(['webrtc_url', 'hls_url', 'expires_at']);

        $this->actingAs($superAdmin, 'sanctum')
            ->getJson("/api/v1/cctv/snapshot/{$camera->id}")
            ->assertStatus(200)
            ->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_user_can_stream_visibility_all_camera_in_their_project(): void
    {
        [$project, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(200);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/cctv/snapshot/{$camera->id}")
            ->assertStatus(200);
    }

    public function test_user_cannot_stream_admin_only_device(): void
    {
        [$project, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(403);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/cctv/snapshot/{$camera->id}")
            ->assertStatus(403);
    }

    public function test_user_can_stream_specific_camera_only_when_explicitly_assigned(): void
    {
        [$project, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $assignedUser = $this->makeUserWithRole('user');
        $unassignedUser = $this->makeUserWithRole('user');
        $this->assignUserToProject($assignedUser, $project);
        $this->assignUserToProject($unassignedUser, $project);

        $camera->viewers()->attach($assignedUser->id);

        $this->actingAs($assignedUser, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(200);

        $this->actingAs($unassignedUser, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(403);
    }

    public function test_user_not_assigned_to_the_project_cannot_stream(): void
    {
        [, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $user = $this->makeUserWithRole('user');
        // Deliberately not assigned to the project.

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(403);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();

        $this->postJson("/api/v1/cctv/live/{$camera->id}")->assertStatus(401);
        $this->getJson("/api/v1/cctv/snapshot/{$camera->id}")->assertStatus(401);
    }

    public function test_mint_response_never_contains_ip_rtsp_url_or_credentials(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}")
            ->assertStatus(200);

        $body = $response->getContent();

        $this->assertStringNotContainsString($device->ip_address, $body);
        $this->assertStringNotContainsString('rtsp://', $body);
        $this->assertStringNotContainsString($device->username, $body);
    }

    public function test_mint_returns_distinct_paths_embedded_in_urls_for_main_vs_sub_quality(): void
    {
        [$project, , $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $main = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}", ['quality' => 'main'])
            ->assertStatus(200)
            ->json();

        $sub = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/live/{$camera->id}", ['quality' => 'sub'])
            ->assertStatus(200)
            ->json();

        $this->assertNotSame($main['webrtc_url'], $sub['webrtc_url']);
    }
}
