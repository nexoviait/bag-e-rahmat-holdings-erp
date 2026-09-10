<?php

namespace App\Modules\Chat\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'sender' => $this->whenLoaded('sender', fn () => [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_path' => $this->sender->avatar_path,
            ]),
            'type' => $this->type,
            'body' => $this->body,
            'attachment_path' => $this->attachment_path,
            'attachment_name' => $this->attachment_name,
            'attachment_mime' => $this->attachment_mime,
            'attachment_size' => $this->attachment_size,
            'attachment_duration_ms' => $this->attachment_duration_ms,
            'reply_to_message_id' => $this->reply_to_message_id,
            'created_at' => $this->created_at,
        ];
    }
}
