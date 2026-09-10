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
 * Every lifecycle change during a call — someone accepted/declined/joined/
 * left, or the whole call ended — broadcasts here on the call's own channel.
 * This is what tells the mesh in useCallPeer.ts when to open a new peer
 * connection to an arriving participant or tear one down for a departing
 * one; ShouldBroadcastNow for the same reason as CallRinging.
 */
class CallStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat.call.'.$this->call->id)];
    }

    public function broadcastAs(): string
    {
        return 'call.status_updated';
    }

    public function broadcastWith(): array
    {
        return (new CallResource($this->call))->resolve();
    }
}
