<?php

namespace App\Modules\Cctv\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Never includes stream_url/snapshot_url with embedded credentials or the raw
 * RTSP source — those are built server-side only when Phase 3 (MediaMTX) wires
 * up /cctv/live/{camera}. This resource exposes metadata only.
 */
class CameraChannelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'device' => $this->whenLoaded('device', fn () => [
                'id' => $this->device->id,
                'device_name' => $this->device->device_name,
                'status' => $this->device->status,
                'project' => $this->device->relationLoaded('project') ? [
                    'id' => $this->device->project->id,
                    'name' => $this->device->project->name,
                    'code' => $this->device->project->code,
                ] : null,
            ]),
            'channel_number' => $this->channel_number,
            'camera_name' => $this->camera_name,
            'location' => $this->location,
            'stream_path' => $this->stream_path,
            'status' => $this->status,
            'last_seen_at' => $this->last_seen_at,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
