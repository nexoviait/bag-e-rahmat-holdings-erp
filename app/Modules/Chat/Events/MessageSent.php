<?php

namespace App\Modules\Chat\Events;

use App\Models\Message;
use App\Modules\Chat\Http\Resources\MessageResource;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Queued (not latency-critical the way a ringing call is) — see
 * CallRinging/CallStatusUpdated in Phase C for the ShouldBroadcastNow
 * counterpart. Broadcasts on two kinds of channel at once:
 *  - the conversation channel, for anyone with that thread actually open;
 *  - every OTHER active participant's personal channel, so their
 *    conversation list updates live (new-message preview, unread badge)
 *    even when they don't have this thread open at all.
 * The sender's own tab never receives this — the controller calls
 * ->toOthers(), matched by X-Socket-Id (see lib/api.ts's request
 * interceptor), since the sender already rendered its own message optimistically.
 */
class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message,
        /** @var int[] */
        public array $recipientUserIds,
        public int $projectId,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel('chat.conversation.'.$this->message->conversation_id)];

        foreach ($this->recipientUserIds as $userId) {
            $channels[] = new PrivateChannel('chat.user.'.$userId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastWith(): array
    {
        return [
            ...(new MessageResource($this->message))->resolve(),
            // Not part of MessageResource's own shape — added so a GLOBAL
            // listener (subscribed on chat.user.{id} from anywhere in the
            // app, not just this conversation's thread) can tell which
            // project's Chat tab a notification should deep-link to without
            // a second round-trip.
            'project_id' => $this->projectId,
        ];
    }
}
