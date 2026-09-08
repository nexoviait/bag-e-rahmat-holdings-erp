<?php

namespace App\Modules\Cctv;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Modules\Cctv\Contracts\CameraAccessRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraChannelRepositoryInterface;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrDeviceRepositoryInterface;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\Contracts\MediaMtxGatewayInterface;
use App\Modules\Cctv\Policies\CameraChannelPolicy;
use App\Modules\Cctv\Policies\DvrDevicePolicy;
use App\Modules\Cctv\Repositories\EloquentCameraAccessRepository;
use App\Modules\Cctv\Repositories\EloquentCameraChannelRepository;
use App\Modules\Cctv\Repositories\EloquentCameraLogRepository;
use App\Modules\Cctv\Repositories\EloquentDvrDeviceRepository;
use App\Modules\Cctv\Services\Gateways\DahuaHttpGateway;
use App\Modules\Cctv\Services\Gateways\FakeDvrGateway;
use App\Modules\Cctv\Services\Gateways\FakeMediaMtxGateway;
use App\Modules\Cctv\Services\Gateways\MediaMtxHttpGateway;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Wires the CCTV module's Repository/Gateway interfaces to their implementations
 * and registers its Policies. The app has no AuthServiceProvider and no existing
 * Gate::policy() calls anywhere, so policy auto-discovery (App\Models\X ->
 * App\Policies\XPolicy) would never find policies living inside this module —
 * explicit registration here is required, not optional.
 *
 * CCTV_DRIVER (config('services.cctv.driver'), default 'live') swaps
 * DvrGatewayInterface between the real Dahua HTTP gateway and a deterministic
 * fake with zero code changes anywhere else — see FakeDvrGateway's docblock for
 * why this exists.
 */
class CctvServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DvrDeviceRepositoryInterface::class, EloquentDvrDeviceRepository::class);
        $this->app->bind(CameraChannelRepositoryInterface::class, EloquentCameraChannelRepository::class);
        $this->app->bind(CameraLogRepositoryInterface::class, EloquentCameraLogRepository::class);
        $this->app->bind(CameraAccessRepositoryInterface::class, EloquentCameraAccessRepository::class);

        $this->app->bind(DvrGatewayInterface::class, function () {
            $driver = config('services.cctv.driver', 'live');

            return $driver === 'fake'
                ? new FakeDvrGateway()
                : new DahuaHttpGateway();
        });

        $this->app->bind(MediaMtxGatewayInterface::class, function () {
            $driver = config('services.cctv.driver', 'live');

            return $driver === 'fake'
                ? new FakeMediaMtxGateway()
                : new MediaMtxHttpGateway();
        });
    }

    public function boot(): void
    {
        Gate::policy(DvrDevice::class, DvrDevicePolicy::class);
        Gate::policy(CameraChannel::class, CameraChannelPolicy::class);
    }
}
