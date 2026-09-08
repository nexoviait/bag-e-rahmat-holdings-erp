<?php

namespace App\Modules\Cctv\Repositories;

use App\Models\CameraChannel;
use App\Models\CameraLog;
use App\Models\DvrDevice;
use App\Modules\Cctv\Contracts\CameraLogRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

final class EloquentCameraLogRepository implements CameraLogRepositoryInterface
{
    public function record(
        string $event,
        ?CameraChannel $camera = null,
        ?DvrDevice $device = null,
        ?string $description = null,
        ?array $meta = null,
        ?int $userId = null,
    ): CameraLog {
        return CameraLog::create([
            'camera_channel_id' => $camera?->id,
            'dvr_device_id' => $device?->id ?? $camera?->dvr_device_id,
            'event' => $event,
            'description' => $description,
            'meta' => $meta,
            'created_by' => $userId,
        ]);
    }

    public function listForCamera(CameraChannel $camera, int $limit = 50): Collection
    {
        return CameraLog::where('camera_channel_id', $camera->id)
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
}
