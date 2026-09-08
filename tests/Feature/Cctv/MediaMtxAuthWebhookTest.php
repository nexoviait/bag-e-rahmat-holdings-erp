<?php

namespace Tests\Feature\Cctv;

use App\Modules\Cctv\Support\StreamTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The MediaMTX authHTTPAddress webhook is deliberately NOT behind Sanctum
 * (MediaMTX isn't a logged-in user) — it's protected by a shared secret baked
 * into the webhook URL, validated here. Also confirms the token check is
 * TTL-only (repeatable), not single-use, since MediaMTX re-validates on every
 * reconnect/segment fetch — a single-use implementation would silently break
 * auto-reconnect.
 */
class MediaMtxAuthWebhookTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config(['services.mediamtx.auth_secret' => 'test-shared-secret']);
    }

    public function test_rejects_a_request_missing_the_secret(): void
    {
        $this->postJson('/api/v1/cctv/mediamtx/auth', ['path' => 'dvr1-ch1', 'token' => 'whatever'])
            ->assertStatus(401);
    }

    public function test_rejects_a_request_with_the_wrong_secret(): void
    {
        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=wrong', ['path' => 'dvr1-ch1', 'token' => 'whatever'])
            ->assertStatus(401);
    }

    public function test_fails_closed_when_no_secret_is_configured_at_all(): void
    {
        config(['services.mediamtx.auth_secret' => '']);

        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=', ['path' => 'dvr1-ch1', 'token' => 'whatever'])
            ->assertStatus(401);
    }

    public function test_rejects_an_unknown_token_even_with_the_correct_secret(): void
    {
        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', [
            'path' => 'dvr1-ch1',
            'token' => 'not-a-real-token',
        ])->assertStatus(401);
    }

    public function test_accepts_a_freshly_minted_token_for_the_matching_path(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $minted = (new StreamTokenService())->mint($camera, $user, \App\Models\CameraChannel::QUALITY_MAIN);

        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', [
            'path' => $minted['path'],
            'token' => $minted['token'],
        ])->assertStatus(200);
    }

    public function test_rejects_a_valid_token_presented_against_a_different_path(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $minted = (new StreamTokenService())->mint($camera, $user, \App\Models\CameraChannel::QUALITY_MAIN);

        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', [
            'path' => 'some-other-camera-path',
            'token' => $minted['token'],
        ])->assertStatus(401);
    }

    public function test_a_token_can_be_validated_repeatedly_not_just_once(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $minted = (new StreamTokenService())->mint($camera, $user, \App\Models\CameraChannel::QUALITY_MAIN);

        $payload = ['path' => $minted['path'], 'token' => $minted['token']];

        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', $payload)->assertStatus(200);
        // Simulates MediaMTX re-checking on a reconnect / next HLS segment fetch.
        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', $payload)->assertStatus(200);
    }

    public function test_extracts_the_token_from_a_raw_query_string_field_as_mediamtx_actually_sends_it(): void
    {
        [, , $camera] = $this->makeProjectWithDevice();
        $user = $this->makeUserWithRole('user');
        $minted = (new StreamTokenService())->mint($camera, $user, \App\Models\CameraChannel::QUALITY_MAIN);

        // MediaMTX's real webhook payload carries the original request's raw
        // query string in a `query` field, not a pre-parsed `token` field.
        $this->postJson('/api/v1/cctv/mediamtx/auth?secret=test-shared-secret', [
            'path' => $minted['path'],
            'query' => 'token=' . $minted['token'],
        ])->assertStatus(200);
    }
}
