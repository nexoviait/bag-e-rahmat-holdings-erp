<?php

namespace App\Modules\SiteTracking\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaterialTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'material_id' => $this->material_id,
            'material_name' => $this->whenLoaded('material', fn () => $this->material->name),
            'unit' => $this->whenLoaded('material', fn () => $this->material->unit),
            'type' => $this->type,
            'date' => $this->date?->format('Y-m-d'),
            'quantity' => $this->quantity !== null ? (float) $this->quantity : null,
            'unit_price' => $this->unit_price !== null ? (float) $this->unit_price : null,
            'total_cost' => $this->total_cost !== null ? (float) $this->total_cost : null,
            'supplier' => $this->supplier,
            'used_for' => $this->used_for,
            'created_at' => $this->created_at,
        ];
    }
}
