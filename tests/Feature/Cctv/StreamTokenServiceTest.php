<?php

namespace Tests\Feature\Cctv;

use App\Models\CameraChannel;
use App\Modules\Cctv\Support\StreamTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class StreamTokenServiceTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_mint_returns_a_token_and_the_correct_stream_path(): void
    {
        [, $device, $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $result = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);

        $this->assertNotEmpty($result['token']);
        $this->assertSame("dvr{$device->id}-ch{$camera->channel_number}", $result['path']);
        $this->assertTrue($result['expires_at']->isFuture());
    }

    public function test_mint_produces_distinct_paths_for_main_and_sub_quality(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $main = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);
        $sub = $service->mint($camera, $user, CameraChannel::QUALITY_SUB);

        $this->assertNotSame($main['path'], $sub['path']);
        $this->assertSame($main['path'] . '-sub', $sub['path']);
    }

    public function test_validate_succeeds_for_a_freshly_minted_token_and_matching_path(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $minted = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);

        $this->assertTrue($service->validate($minted['token'], $minted['path']));
    }

    public function test_validate_fails_for_an_unknown_token(): void
    {
        $service = new StreamTokenService();

        $this->assertFalse($service->validate('not-a-real-token', 'dvr1-ch1'));
    }

    public function test_validate_fails_when_path_does_not_match_the_token_it_was_minted_for(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $minted = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);

        $this->assertFalse($service->validate($minted['token'], 'dvr999-ch999'));
    }

    public function test_validate_does_not_consume_the_token_so_repeated_checks_still_succeed(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $minted = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);

        $this->assertTrue($service->validate($minted['token'], $minted['path']));
        // A second (and third) check must still pass — MediaMTX re-validates on
        // every reconnect/segment fetch, not just the first connection.
        $this->assertTrue($service->validate($minted['token'], $minted['path']));
        $this->assertTrue($service->validate($minted['token'], $minted['path']));
    }

    public function test_validate_fails_after_the_token_expires(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $service = new StreamTokenService();

        $minted = $service->mint($camera, $user, CameraChannel::QUALITY_MAIN);

        // Simulate TTL expiry directly rather than sleeping the test suite.
        Cache::forget("cctv:stream-token:{$minted['token']}");

        $this->assertFalse($service->validate($minted['token'], $minted['path']));
    }
}
