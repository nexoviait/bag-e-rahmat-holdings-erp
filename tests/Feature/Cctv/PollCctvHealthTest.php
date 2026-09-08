<?php

namespace Tests\Feature\Cctv;

use App\Console\Commands\PollCctvHealth;
use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\DTO\DeviceProbeResultData;
use App\Notifications\DvrDeviceOfflineNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\NullOutput;
use Tests\TestCase;

/**
 * QUEUE_CONNECTION=sync in phpunit.xml, so queued notifications actually run
 * synchronously here — no Notification::fake() needed, these tests confirm a
 * real row lands in the real `notifications` table, not just that dispatch
 * was attempted.
 *
 * Runs the command via a freshly-resolved instance's run() rather than the
 * $this->artisan() test helper: Artisan's console kernel resolves and caches
 * each auto-discovered command once at application bootstrap (before a test
 * method body runs), so rebinding DvrGatewayInterface mid-test has no effect
 * on that already-constructed cached instance. app(PollCctvHealth::class)
 * builds a brand-new instance reflecting the container's bindings at the
 * moment it's called, which is what these tests need to inject a controlled
 * fake per scenario.
 */
class PollCctvHealthTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function bindGatewayReturning(DeviceProbeResultData $result): void
    {
        $this->app->bind(DvrGatewayInterface::class, fn () => new class($result) implements DvrGatewayInterface {
            public function __construct(private readonly DeviceProbeResultData $result) {}

            public function testConnection(DvrDevice $device): DeviceProbeResultData
            {
                return $this->result;
            }

            public function discoverChannels(DvrDevice $device): array
            {
                return [];
            }

            public function fetchSnapshot(DvrDevice $device, int $channelNumber): string
            {
                return '';
            }
        });
    }

    private function runPollHealth(): void
    {
        $command = app(PollCctvHealth::class);
        $command->setLaravel($this->app);
        $command->run(new ArrayInput([]), new NullOutput());
    }

    public function test_transition_to_offline_cascades_cameras_offline_and_notifies_project_members(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->bindGatewayReturning(DeviceProbeResultData::unreachable('Cannot reach the recorder.'));
        $this->runPollHealth();

        $device->refresh();
        $camera->refresh();
        $this->assertSame(DvrDevice::STATUS_OFFLINE, $device->status);
        $this->assertSame(CameraChannel::STATUS_OFFLINE, $camera->status);

        $this->assertSame(1, $manager->notifications()->count());
        $this->assertSame(DvrDeviceOfflineNotification::class, $manager->notifications()->first()->type);
        $this->assertSame($device->id, $manager->notifications()->first()->data['device_id']);
    }

    public function test_a_device_that_stays_down_does_not_renotify_on_a_second_poll(): void
    {
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->bindGatewayReturning(DeviceProbeResultData::unreachable('down'));

        $this->runPollHealth();
        $this->assertSame(1, $manager->notifications()->count());

        $this->runPollHealth();
        $this->assertSame(1, $manager->notifications()->count(), 'a device already offline must not re-notify on the next poll');
    }

    public function test_a_device_that_stays_online_never_notifies(): void
    {
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $manager = $this->makeUserWithRole('manager');
        $this->assignUserToProject($manager, $project);

        $this->bindGatewayReturning(DeviceProbeResultData::success('NVR', 'SN123'));
        $this->runPollHealth();

        $this->assertSame(0, $manager->notifications()->count());
    }

    public function test_recipients_are_filtered_to_users_who_can_view_devices(): void
    {
        [$project, $device] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $manager = $this->makeUserWithRole('manager'); // has cctv.devices.view
        $plainUser = $this->makeUserWithRole('user');  // does NOT have cctv.devices.view
        $this->assignUserToProject($manager, $project);
        $this->assignUserToProject($plainUser, $project);

        $this->bindGatewayReturning(DeviceProbeResultData::unreachable('down'));
        $this->runPollHealth();

        $this->assertSame(1, $manager->notifications()->count());
        $this->assertSame(0, $plainUser->notifications()->count());
    }

    public function test_coming_back_online_does_not_cascade_cameras_back_to_online(): void
    {
        [$project, $device, $camera] = $this->makeProjectWithDevice(deviceStatus: DvrDevice::STATUS_ONLINE);
        $this->assignUserToProject($this->makeUserWithRole('manager'), $project);

        $this->bindGatewayReturning(DeviceProbeResultData::unreachable('down'));
        $this->runPollHealth();
        $camera->refresh();
        $this->assertSame(CameraChannel::STATUS_OFFLINE, $camera->status);

        $this->bindGatewayReturning(DeviceProbeResultData::success('NVR', 'SN123'));
        $this->runPollHealth();

        $device->refresh();
        $camera->refresh();
        $this->assertSame(DvrDevice::STATUS_ONLINE, $device->status);
        // Device is back up, but the camera is left offline for the
        // opportunistic per-view check to correct, not cascaded automatically.
        $this->assertSame(CameraChannel::STATUS_OFFLINE, $camera->status);
    }
}
