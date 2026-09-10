<?php

namespace App\Modules\Chat\Policies;

use App\Models\Conversation;
use App\Models\User;
use App\Modules\Chat\Support\ChatPermission;

/**
 * Gate::before in AppServiceProvider bypasses every method here for
 * super_admin. 'admin' gets an explicit, deliberate bypass ONLY for the
 * read-side abilities (viewAny/view) — this is the confirmed product
 * decision that admins can see every project conversation, including
 * private 1:1 DMs, matching the existing CCTV/Documents trust model.
 *
 * It does NOT extend to writing: sendMessage/manageMembers/leave all require
 * genuine active participancy even for an admin, so admin visibility stays
 * oversight-only rather than letting an admin inject messages into (or
 * silently manage) a DM they were never actually part of.
 */
class ConversationPolicy
{
    public function viewAny(User $user, ?int $projectId = null): bool
    {
        if (!$user->can(ChatPermission::VIEW)) {
            return false;
        }

        if ($projectId === null || $user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
        }

        return $user->projects->contains($projectId);
    }

    public function view(User $user, Conversation $conversation): bool
    {
        if (!$user->can(ChatPermission::VIEW)) {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
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

    /** Rename/avatar/add-remove-members — group-admin only (never for a direct conversation). */
    public function manageMembers(User $user, Conversation $conversation): bool
    {
        if ($conversation->type !== 'group') {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return true;
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
