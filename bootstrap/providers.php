<?php

use App\Modules\Cctv\CctvServiceProvider;
use App\Modules\SiteTracking\SiteTrackingServiceProvider;
use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    CctvServiceProvider::class,
    SiteTrackingServiceProvider::class,
];
