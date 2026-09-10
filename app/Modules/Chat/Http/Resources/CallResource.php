<?php

namespace App\Modules\Chat\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CallResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'conversation_id' => $this->conversation_id,
            'type' => $this->type,
            'status' => $this->status,
            'initiated_by' => $this->initiated_by,
            'initiator' => $this->whenLoaded('initiator', fn () => [
                'id' => $this->initiator->id,
                'name' => $this->initiator->name,
                'avatar_path' => $this->initiator->avatar_path,
            ]),
            'started_at' => $this->started_at,
            'ended_at' => $this->ended_at,
            'end_reason' => $this->end_reason,
            'participants' => $this->whenLoaded('participants', fn () => $this->participants->map(fn ($p) => [
                'user_id' => $p->user_id,
                'name' => $p->relationLoaded('user') ? $p->user?->name : null,
                'avatar_path' => $p->relationLoaded('user') ? $p->user?->avatar_path : null,
                'status' => $p->status,
                'joined_at' => $p->joined_at,
                'left_at' => $p->left_at,
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
