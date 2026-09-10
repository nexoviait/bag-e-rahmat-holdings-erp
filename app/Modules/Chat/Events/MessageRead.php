<?php

namespace App\Modules\Chat\Events;

use App\Models\ConversationParticipant;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Lets an open thread flip its read-receipt ticks live for everyone else
 * looking at it, without a per-message-per-recipient read table — see the
 * single last_read_message_id watermark on conversation_participants.
 */
class MessageRead implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public ConversationParticipant $participant,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat.conversation.'.$this->participant->conversation_id)];
    }

    public function broadcastAs(): string
    {
        return 'message.read';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->participant->conversation_id,
            'user_id' => $this->participant->user_id,
            'last_read_message_id' => $this->participant->last_read_message_id,
            'last_read_at' => optional($this->participant->last_read_at)->toIso8601String(),
        ];
    }
}
