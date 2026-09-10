<?php

namespace App\Modules\Chat\Events;

use App\Models\Conversation;
use App\Modules\Chat\Http\Resources\ConversationResource;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired to every new participant EXCEPT the creator (who already has the
 * conversation from the HTTP response) so a brand-new DM/group appears in
 * their conversation list live, with no page refresh.
 */
class ConversationCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Conversation $conversation,
        /** @var int[] */
        public array $recipientUserIds,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        return array_map(
            fn (int $userId) => new PrivateChannel('chat.user.'.$userId),
            $this->recipientUserIds
        );
    }

    public function broadcastAs(): string
    {
        return 'conversation.created';
    }

    public function broadcastWith(): array
    {
        return (new ConversationResource($this->conversation))->resolve();
    }
}
