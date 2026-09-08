<?php

namespace Tests\Feature\Cctv;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Stops a future refactor from accidentally leaking DVR credentials. Cheap to
 * run, catches an entire class of mistake: a stray ->toArray() on the model
 * instead of the Resource, a debug field left in, a new endpoint that forgot
 * to redact.
 */
class CredentialLeakTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithCctvFixtures;

    private const KNOWN_PASSWORD = 'S3cret!Password#With@Specials';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_device_list_and_show_never_contain_the_password(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device] = $this->makeProjectWithDevice();
        $device->update(['password' => self::KNOWN_PASSWORD]);

        $listResponse = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/cctv/devices');
        $listResponse->assertStatus(200);
        $this->assertStringNotContainsString(self::KNOWN_PASSWORD, $listResponse->getContent());
        $this->assertStringNotContainsString('"password"', $listResponse->getContent());

        $showResponse = $this->actingAs($admin, 'sanctum')->getJson("/api/v1/cctv/devices/{$device->id}");
        $showResponse->assertStatus(200);
        $this->assertStringNotContainsString(self::KNOWN_PASSWORD, $showResponse->getContent());
        $this->assertStringNotContainsString('"password"', $showResponse->getContent());
    }

    public function test_create_response_never_contains_the_password_just_submitted(): void
    {
        $admin = $this->makeUserWithRole('admin');
        $project = \App\Models\Project::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/cctv/devices', [
            'project_id' => $project->id,
            'device_name' => 'Test DVR',
            'ip_address' => '10.0.0.5',
            'username' => 'admin',
            'password' => self::KNOWN_PASSWORD,
        ]);

        $response->assertStatus(201);
        $this->assertStringNotContainsString(self::KNOWN_PASSWORD, $response->getContent());
        $this->assertStringNotContainsString('"password"', $response->getContent());
    }

    public function test_no_endpoint_ever_returns_a_raw_rtsp_url(): void
    {
        $admin = $this->makeUserWithRole('admin');
        [$project, $device, $camera] = $this->makeProjectWithDevice();

        foreach ([
            '/api/v1/cctv/devices',
            "/api/v1/cctv/devices/{$device->id}",
            '/api/v1/cctv/cameras',
            "/api/v1/cctv/cameras/{$camera->id}",
        ] as $endpoint) {
            $response = $this->actingAs($admin, 'sanctum')->getJson($endpoint);
            $this->assertStringNotContainsString('rtsp://', $response->getContent(), "Leaked rtsp:// in {$endpoint}");
        }
    }

    public function test_raw_database_column_is_not_the_plaintext_password(): void
    {
        [$project, $device] = $this->makeProjectWithDevice();
        $device->update(['password' => self::KNOWN_PASSWORD]);

        $rawColumnValue = \Illuminate\Support\Facades\DB::table('dvr_devices')->where('id', $device->id)->value('password');

        $this->assertNotSame(self::KNOWN_PASSWORD, $rawColumnValue);
        $this->assertGreaterThan(100, strlen($rawColumnValue));
    }
}
