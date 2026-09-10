<?php

namespace App\Modules\Chat\Policies;

use App\Models\Call;
use App\Models\User;

/**
 * Unlike ConversationPolicy, admin gets NO bypass here at all — a call is a
 * live audio/video session between specific people, not a message history
 * an admin might need to audit later. Every ability requires actually being
 * one of the invited participants.
 */
class CallPolicy
{
    public function view(User $user, Call $call): bool
    {
        return $call->participants()->where('user_id', $user->id)->exists();
    }

    public function respond(User $user, Call $call): bool
    {
        return $call->participants()->where('user_id', $user->id)->where('status', 'ringing')->exists();
    }

    public function end(User $user, Call $call): bool
    {
        return $call->participants()
            ->where('user_id', $user->id)
            ->whereIn('status', ['ringing', 'joined'])
            ->exists();
    }
}
