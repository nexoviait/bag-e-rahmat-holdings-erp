<?php

namespace App\Modules\SiteTracking\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaterialResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'name' => $this->name,
            'unit' => $this->unit,
            'reorder_level' => $this->reorder_level,
            'notes' => $this->notes,
            'is_active' => $this->is_active,
            // Only present when loaded via listWithStock() — null on a bare
            // find()/create() response where no stock aggregate was computed.
            'current_stock' => $this->when(isset($this->current_stock), fn () => (float) $this->current_stock),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
