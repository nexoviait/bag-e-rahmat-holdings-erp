<?php

namespace App\Modules\Cctv\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * NEVER include 'password' here, under any circumstance, for any role — the API
 * never returns the plaintext or encrypted credential once written. An edit form
 * shows an empty password field with "leave blank to keep current" semantics.
 */
class DvrDeviceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project' => $this->whenLoaded('project', fn () => [
                'id' => $this->project->id,
                'name' => $this->project->name,
                'code' => $this->project->code,
            ]),
            'device_name' => $this->device_name,
            'brand' => $this->brand,
            'model' => $this->model,
            'ip_address' => $this->ip_address,
            'http_port' => $this->http_port,
            'rtsp_port' => $this->rtsp_port,
            'username' => $this->username,
            'serial_number' => $this->serial_number,
            'channel_count' => $this->channel_count,
            'visibility' => $this->visibility,
            'status' => $this->status,
            'last_seen_at' => $this->last_seen_at,
            'last_error' => $this->last_error,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
