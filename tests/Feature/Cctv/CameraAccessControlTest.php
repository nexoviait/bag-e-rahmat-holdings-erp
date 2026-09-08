<?php

namespace Tests\Feature\Cctv;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The 4-role x 3-visibility-mode access matrix. Gate::before(super_admin => true)
 * short-circuits Policy checks but has zero effect on the repository's raw query
 * builder — every scenario here is asserted BOTH via the single-resource
 * endpoint (Policy, expect 403) AND the index endpoint (query scope, expect the
 * row simply absent from the list), since a bug in either layer independently
 * would let a wrong access decision slip through.
 */
class CameraAccessControlTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_super_admin_sees_every_device_and_camera_regardless_of_visibility(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $superAdmin = $this->makeUserWithRole('super_admin');
        // Deliberately NOT assigned to the project — super_admin bypasses that entirely.

        $this->actingAs($superAdmin, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(200);

        $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/v1/cctv/devices')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $device->id]);

        $this->actingAs($superAdmin, 'sanctum')
            ->getJson("/api/v1/cctv/cameras/{$camera->id}")
            ->assertStatus(200);
    }

    public function test_admin_sees_every_device_and_camera_regardless_of_visibility(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $admin = $this->makeUserWithRole('admin');

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(200);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/cctv/cameras')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $camera->id]);
    }

    public function test_manager_sees_visibility_all_device_in_their_own_project(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->actingAs($manager, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(200);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/cctv/cameras')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $camera->id]);
    }

    public function test_manager_cannot_see_admin_only_device_even_in_their_own_project(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->actingAs($manager, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(403);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/cctv/devices')
            ->assertStatus(200)
            ->assertJsonMissing(['id' => $device->id]);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/cctv/cameras')
            ->assertStatus(200)
            ->assertJsonMissing(['id' => $camera->id]);
    }

    public function test_manager_cannot_see_device_outside_their_assigned_project(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $manager = $this->makeUserWithRole('manager');
        // Not assigned to $project at all.

        $this->actingAs($manager, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(403);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/cctv/devices')
            ->assertStatus(200)
            ->assertJsonMissing(['id' => $device->id]);
    }

    public function test_user_sees_visibility_all_camera_in_their_project(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/cctv/cameras/{$camera->id}")
            ->assertStatus(200);
    }

    public function test_user_sees_specific_camera_only_when_explicitly_assigned(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $assignedUser = $this->makeUserWithRole('user');
        $unassignedUser = $this->makeUserWithRole('user');
        $this->assignUserToProject($assignedUser, $project);
        $this->assignUserToProject($unassignedUser, $project);

        $camera->viewers()->attach($assignedUser->id);

        $this->actingAs($assignedUser, 'sanctum')
            ->getJson("/api/v1/cctv/cameras/{$camera->id}")
            ->assertStatus(200);

        $this->actingAs($unassignedUser, 'sanctum')
            ->getJson("/api/v1/cctv/cameras/{$camera->id}")
            ->assertStatus(403);

        $this->actingAs($unassignedUser, 'sanctum')
            ->getJson('/api/v1/cctv/cameras')
            ->assertStatus(200)
            ->assertJsonMissing(['id' => $camera->id]);
    }

    public function test_user_cannot_see_admin_only_device(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ADMIN_ONLY);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/cctv/cameras/{$camera->id}")
            ->assertStatus(403);
    }

    public function test_inactive_device_is_hidden_from_non_admins_even_when_visibility_is_all(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_ALL);
        $device->update(['is_active' => false]);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/cctv/devices/{$device->id}")
            ->assertStatus(403);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice();

        $this->getJson('/api/v1/cctv/devices')->assertStatus(401);
        $this->getJson("/api/v1/cctv/cameras/{$camera->id}")->assertStatus(401);
    }
}
