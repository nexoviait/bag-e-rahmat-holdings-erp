<?php

namespace Tests\Feature\Cctv;

use App\Models\DvrDevice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CameraAccessAssignmentTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_assign_project_members_to_a_specific_visibility_camera(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $member = $this->makeUserWithRole('user');
        $this->assignUserToProject($member, $project);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/cctv/cameras/{$camera->id}/assignments", ['user_ids' => [$member->id]]);

        $response->assertStatus(200)->assertJsonFragment(['id' => $member->id]);

        $this->assertDatabaseHas('camera_user_assignments', [
            'camera_channel_id' => $camera->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('activity_logs', ['entity' => 'CameraChannel']);
    }

    public function test_cannot_assign_a_user_who_is_not_a_project_member(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $outsider = $this->makeUserWithRole('user');
        // Deliberately not assigned to $project.

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/cctv/cameras/{$camera->id}/assignments", ['user_ids' => [$outsider->id]]);

        $response->assertStatus(422)->assertJsonValidationErrors(['user_ids']);
        $this->assertDatabaseMissing('camera_user_assignments', ['user_id' => $outsider->id]);
    }

    public function test_sync_replaces_the_previous_assignment_list(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $memberA = $this->makeUserWithRole('user');
        $memberB = $this->makeUserWithRole('user');
        $this->assignUserToProject($memberA, $project);
        $this->assignUserToProject($memberB, $project);

        $camera->viewers()->attach($memberA->id);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/cctv/cameras/{$camera->id}/assignments", ['user_ids' => [$memberB->id]])
            ->assertStatus(200);

        $this->assertDatabaseMissing('camera_user_assignments', ['user_id' => $memberA->id]);
        $this->assertDatabaseHas('camera_user_assignments', ['user_id' => $memberB->id]);
    }

    public function test_user_role_cannot_manage_camera_assignments(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(DvrDevice::VISIBILITY_SPECIFIC);
        $user = $this->makeUserWithRole('user');
        $this->assignUserToProject($user, $project);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/cctv/cameras/{$camera->id}/assignments", ['user_ids' => [$user->id]])
            ->assertStatus(403);
    }
}
