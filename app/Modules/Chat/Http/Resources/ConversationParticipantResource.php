<?php

namespace App\Modules\Chat\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationParticipantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->user_id,
            'name' => $this->whenLoaded('user', fn () => $this->user->name),
            'email' => $this->whenLoaded('user', fn () => $this->user->email),
            'avatar_path' => $this->whenLoaded('user', fn () => $this->user->avatar_path),
            'last_seen_at' => $this->whenLoaded('user', fn () => $this->user->last_seen_at),
            'role' => $this->role,
            'muted' => $this->muted,
            'joined_at' => $this->joined_at,
            'left_at' => $this->left_at,
            'last_read_message_id' => $this->last_read_message_id,
            'last_read_at' => $this->last_read_at,
        ];
    }
}
