<?php

namespace App\Modules\Chat\Events;

use App\Models\Call;
use App\Modules\Chat\Http\Resources\CallResource;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * ShouldBroadcastNow, not ShouldBroadcast — a ringing call queued behind
 * other jobs on this app's still-fairly-new broadcasting infra could ring
 * seconds late or (if the worker is ever down, as already happened once
 * this session) not ring at all. Fired once per invited participant's own
 * personal channel — this is what lets a call ring from anywhere in the
 * app, not just while the recipient happens to have the Chat tab open.
 */
class CallRinging implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call,
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
        return 'call.ringing';
    }

    public function broadcastWith(): array
    {
        return (new CallResource($this->call))->resolve();
    }
}
