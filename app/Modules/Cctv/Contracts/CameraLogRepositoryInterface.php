<?php

namespace App\Modules\Cctv\Contracts;

use App\Models\CameraChannel;
use App\Models\CameraLog;
use App\Models\DvrDevice;
use Illuminate\Database\Eloquent\Collection;

interface CameraLogRepositoryInterface
{
    public function record(
        string $event,
        ?CameraChannel $camera = null,
        ?DvrDevice $device = null,
        ?string $description = null,
        ?array $meta = null,
        ?int $userId = null,
    ): CameraLog;

    /**
     * @return Collection<int, CameraLog>
     */
    public function listForCamera(CameraChannel $camera, int $limit = 50): Collection;
}
