<?php

namespace App\Modules\Chat\Policies;

use App\Models\Conversation;
use App\Models\User;
use App\Modules\Chat\Support\ChatPermission;

/**
 * Chat is private by design — Gate::before in AppServiceProvider is the ONLY
 * blanket bypass here (super_admin), and every method below relies on that
 * rather than re-granting it explicitly, specifically so it can never drift
 * out of sync with a change there. 'admin' gets NO special visibility into
 * conversations it isn't genuinely part of — unlike CCTV/Documents, a chat
 * (including its 1:1 DMs) is between the people actually in it. This was a
 * deliberately tighter call after the original "admin sees everything" draft
 * turned out to have a real bug: a non-participant viewer (an admin who
 * technically wasn't in a DM) got shown a conversation mislabeled after
 * whichever participant happened to be first in the list — see
 * ConversationList.tsx/MessageThread.tsx's otherParticipant lookups, which
 * assumed the viewer was always one of exactly two people.
 *
 * sendMessage/manageMembers/leave/initiateCall all require genuine active
 * participancy for everyone except super_admin, same as before.
 */
class ConversationPolicy
{
    public function viewAny(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(ChatPermission::VIEW)) {
            return false;
        }

        if ($projectId === null) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function view(User $user, Conversation $conversation): bool
    {
        if (!$user->can(ChatPermission::VIEW)) {
            return false;
        }

        return $this->isActiveParticipant($user, $conversation);
    }

    /** Starting a direct (1:1) conversation — really just "the first message". */
    public function createDirect(User $user, int $projectId): bool
    {
        if (!$user->can(ChatPermission::SEND)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($projectId);
    }

    public function createGroup(User $user, int $projectId): bool
    {
        if (!$user->can(ChatPermission::GROUPS_CREATE)) {
            return false;
        }

        return $user->hasAnyRole(['super_admin', 'admin']) || $user->projects->contains($projectId);
    }

    public function sendMessage(User $user, Conversation $conversation): bool
    {
        return $user->can(ChatPermission::SEND) && $this->isActiveParticipant($user, $conversation);
    }

    public function markRead(User $user, Conversation $conversation): bool
    {
        return $this->isActiveParticipant($user, $conversation);
    }

    /** Starting a call in this conversation — no admin bypass, same reasoning as sendMessage. */
    public function initiateCall(User $user, Conversation $conversation): bool
    {
        return $user->can(ChatPermission::CALLS_INITIATE) && $this->isActiveParticipant($user, $conversation);
    }

    public function leave(User $user, Conversation $conversation): bool
    {
        return $this->isActiveParticipant($user, $conversation);
    }

    /**
     * Rename/avatar/add-remove-members — group-admin only (never for a direct
     * conversation). No 'admin' bypass here either, for the same reason as
     * view() above: managing a group's membership without being able to see
     * its messages at all would be a strange, inconsistent half-permission.
     */
    public function manageMembers(User $user, Conversation $conversation): bool
    {
        if ($conversation->type !== 'group') {
            return false;
        }

        return $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where('role', 'admin')
            ->exists();
    }

    private function isActiveParticipant(User $user, Conversation $conversation): bool
    {
        return $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }
}
