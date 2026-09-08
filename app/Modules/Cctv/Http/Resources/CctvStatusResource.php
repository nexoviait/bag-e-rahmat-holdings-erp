<?php

namespace App\Modules\Cctv\Http\Resources;

use App\Modules\Cctv\DTO\CctvStatusData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property CctvStatusData $resource
 */
class CctvStatusResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->resource->toArray();
    }
}
