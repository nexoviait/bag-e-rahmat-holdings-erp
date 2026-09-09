<?php

namespace App\Modules\SiteTracking\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LaborLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'date' => $this->date?->format('Y-m-d'),
            'labor_type' => $this->labor_type,
            'headcount' => $this->headcount,
            'wage_rate' => $this->wage_rate !== null ? (float) $this->wage_rate : null,
            'total_cost' => (float) $this->total_cost,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
        ];
    }
}
