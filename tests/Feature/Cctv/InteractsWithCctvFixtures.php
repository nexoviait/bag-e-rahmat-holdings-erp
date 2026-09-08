<?php

namespace Tests\Feature\Cctv;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Models\Project;
use App\Models\User;

/**
 * Shared fixture builders for CCTV feature tests — keeps the 4-role x
 * 3-visibility-mode matrix setup out of every individual test method.
 */
trait InteractsWithCctvFixtures
{
    protected function makeUserWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    protected function assignUserToProject(User $user, Project $project): void
    {
        $project->users()->attach($user->id);
    }

    /**
     * @return array{0: Project, 1: DvrDevice, 2: CameraChannel}
     */
    protected function makeProjectWithDevice(
        string $visibility = DvrDevice::VISIBILITY_ALL,
        string $deviceStatus = DvrDevice::STATUS_ONLINE,
    ): array {
        $project = Project::factory()->create();

        $device = DvrDevice::factory()->create([
            'project_id' => $project->id,
            'visibility' => $visibility,
            'status' => $deviceStatus,
        ]);

        $camera = CameraChannel::factory()->create([
            'dvr_device_id' => $device->id,
            'channel_number' => 1,
            'status' => CameraChannel::STATUS_ONLINE,
        ]);

        return [$project, $device, $camera];
    }
}
