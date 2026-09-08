<?php

namespace Tests\Feature\Cctv;

use App\Modules\Cctv\Exceptions\MediaMtxRejectedException;
use App\Modules\Cctv\Exceptions\MediaMtxUnavailableException;
use App\Modules\Cctv\Services\Gateways\MediaMtxHttpGateway;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * No real MediaMTX instance is reachable in this environment, so the exact
 * response shapes of a real server are unverifiable here — but the GET-then-
 * POST idempotency branching itself (the actual logic this gateway owns) is
 * fully testable against a faked HTTP client.
 */
class MediaMtxHttpGatewayTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.mediamtx.api_url' => 'http://127.0.0.1:9997',
            'services.mediamtx.api_version' => 'v3',
        ]);
    }

    public function test_skips_registration_when_the_path_already_exists(): void
    {
        Http::fake([
            'http://127.0.0.1:9997/v3/config/paths/get/*' => Http::response(['name' => 'dvr1-ch1'], 200),
        ]);

        (new MediaMtxHttpGateway())->registerPathIfMissing('dvr1-ch1', 'rtsp://user:pass@10.0.0.5:554/cam');

        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/config/paths/add/'));
    }

    public function test_creates_the_path_when_it_does_not_exist(): void
    {
        Http::fake([
            'http://127.0.0.1:9997/v3/config/paths/get/*' => Http::response(null, 404),
            'http://127.0.0.1:9997/v3/config/paths/add/*' => Http::response(null, 200),
        ]);

        (new MediaMtxHttpGateway())->registerPathIfMissing('dvr1-ch1', 'rtsp://user:pass@10.0.0.5:554/cam');

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/config/paths/add/dvr1-ch1')
                && $request['source'] === 'rtsp://user:pass@10.0.0.5:554/cam'
                && $request['sourceOnDemand'] === true;
        });
    }

    public function test_throws_rejected_when_the_add_call_fails(): void
    {
        Http::fake([
            'http://127.0.0.1:9997/v3/config/paths/get/*' => Http::response(null, 404),
            'http://127.0.0.1:9997/v3/config/paths/add/*' => Http::response(['error' => 'bad source'], 400),
        ]);

        $this->expectException(MediaMtxRejectedException::class);

        (new MediaMtxHttpGateway())->registerPathIfMissing('dvr1-ch1', 'rtsp://user:pass@10.0.0.5:554/cam');
    }

    public function test_throws_rejected_when_the_get_check_returns_an_unexpected_status(): void
    {
        Http::fake([
            'http://127.0.0.1:9997/v3/config/paths/get/*' => Http::response(null, 500),
        ]);

        $this->expectException(MediaMtxRejectedException::class);

        (new MediaMtxHttpGateway())->registerPathIfMissing('dvr1-ch1', 'rtsp://user:pass@10.0.0.5:554/cam');
    }

    public function test_throws_unavailable_when_the_server_is_unreachable(): void
    {
        Http::fake([
            'http://127.0.0.1:9997/v3/config/paths/get/*' => fn () => throw new ConnectionException('Connection refused'),
        ]);

        $this->expectException(MediaMtxUnavailableException::class);

        (new MediaMtxHttpGateway())->registerPathIfMissing('dvr1-ch1', 'rtsp://user:pass@10.0.0.5:554/cam');
    }
}
