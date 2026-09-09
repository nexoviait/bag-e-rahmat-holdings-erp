<?php

namespace App\Modules\SiteTracking;

use App\Models\LaborLog;
use App\Models\Material;
use App\Modules\SiteTracking\Contracts\LaborLogRepositoryInterface;
use App\Modules\SiteTracking\Contracts\MaterialRepositoryInterface;
use App\Modules\SiteTracking\Contracts\MaterialTransactionRepositoryInterface;
use App\Modules\SiteTracking\Policies\LaborLogPolicy;
use App\Modules\SiteTracking\Policies\MaterialPolicy;
use App\Modules\SiteTracking\Repositories\EloquentLaborLogRepository;
use App\Modules\SiteTracking\Repositories\EloquentMaterialRepository;
use App\Modules\SiteTracking\Repositories\EloquentMaterialTransactionRepository;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Wires this module's Repository interfaces to their Eloquent implementations
 * and registers its Policies — same reasoning as CctvServiceProvider: the app
 * has no AuthServiceProvider, so policy auto-discovery would never find a
 * policy living inside App\Modules\..., explicit registration is required.
 */
class SiteTrackingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(MaterialRepositoryInterface::class, EloquentMaterialRepository::class);
        $this->app->bind(MaterialTransactionRepositoryInterface::class, EloquentMaterialTransactionRepository::class);
        $this->app->bind(LaborLogRepositoryInterface::class, EloquentLaborLogRepository::class);
    }

    public function boot(): void
    {
        Gate::policy(Material::class, MaterialPolicy::class);
        Gate::policy(LaborLog::class, LaborLogPolicy::class);
    }
}
