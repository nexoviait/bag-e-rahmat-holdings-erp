<?php

namespace App\Modules\Chat\Services;

use App\Models\ActivityLog;
use App\Models\Conversation;
use App\Models\Project;
use App\Models\User;
use App\Modules\Chat\Contracts\ConversationRepositoryInterface;
use App\Modules\Chat\DTO\ConversationData;
use App\Modules\Chat\Events\ConversationCreated;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ConversationService
{
    public function __construct(
        private readonly ConversationRepositoryInterface $conversations,
    ) {}

    public function listForProject(int $projectId, User $actor): Collection
    {
        return $actor->hasAnyRole(['super_admin', 'admin'])
            ? $this->conversations->listForProject($projectId)
            : $this->conversations->listForProjectAndUser($projectId, $actor->id);
    }

    public function find(int $id): Conversation
    {
        return $this->conversations->findOrFail($id);
    }

    /**
     * Project team roster available to start a conversation with — mirrors
     * ProjectDocumentController::assignableUsers()'s exact convention:
     * assigned users only, admins/super_admins excluded (they're oversight,
     * not deliberately-added chat members).
     */
    public function getMembers(int $projectId): Collection
    {
        return Project::findOrFail($projectId)->users()
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.email', 'users.avatar_path', 'users.last_seen_at'])
            ->filter(fn (User $u) => !$u->hasAnyRole(['super_admin', 'admin']))
            ->values();
    }

    /**
     * Opens (or reuses) the 1:1 conversation between the creator and
     * $otherUserId in this project. direct_key's unique constraint makes this
     * atomic — a genuine race between two simultaneous "start DM" requests
     * resolves to whichever insert wins, with the loser just re-fetching it.
     */
    public function createDirect(int $projectId, User $creator, int $otherUserId): Conversation
    {
        if ($otherUserId === $creator->id) {
            throw ValidationException::withMessages(['member_user_ids' => 'You cannot start a conversation with yourself.']);
        }

        $directKey = $this->directKey($projectId, $creator->id, $otherUserId);

        $existing = $this->conversations->findByDirectKey($directKey);
        if ($existing) {
            return $existing;
        }

        try {
            $conversation = DB::transaction(function () use ($projectId, $creator, $otherUserId, $directKey) {
                $conversation = $this->conversations->create([
                    'project_id' => $projectId,
                    'type' => 'direct',
                    'direct_key' => $directKey,
                    'created_by' => $creator->id,
                ]);

                $this->conversations->addParticipant($conversation, $creator->id, 'member');
                $this->conversations->addParticipant($conversation, $otherUserId, 'member');

                return $conversation;
            });
        } catch (QueryException $e) {
            // Lost the race to a concurrent request for the same pair — the
            // other request's insert already satisfied this one's intent.
            $existing = $this->conversations->findByDirectKey($directKey);
            if ($existing) {
                return $existing;
            }
            throw $e;
        }

        // The creator is never in the recipient list here, so toOthers()
        // never actually has anything to exclude for this call — used anyway
        // for consistency with every other broadcast in this module.
        broadcast(new ConversationCreated($conversation, [$otherUserId]))->toOthers();

        return $conversation;
    }

    public function createGroup(ConversationData $data, User $creator): Conversation
    {
        if (empty($data->name)) {
            throw ValidationException::withMessages(['name' => 'A group name is required.']);
        }

        $memberIds = array_values(array_filter($data->memberUserIds, fn (int $id) => $id !== $creator->id));
        if (count($memberIds) < 1) {
            throw ValidationException::withMessages(['member_user_ids' => 'Pick at least one other member for the group.']);
        }

        $conversation = DB::transaction(function () use ($data, $creator, $memberIds) {
            $conversation = $this->conversations->create([
                'project_id' => $data->projectId,
                'type' => 'group',
                'name' => $data->name,
                'created_by' => $creator->id,
            ]);

            $this->conversations->addParticipant($conversation, $creator->id, 'admin');
            foreach ($memberIds as $userId) {
                $this->conversations->addParticipant($conversation, $userId, 'member');
            }

            return $conversation;
        });

        ActivityLog::create([
            'project_id' => $conversation->project_id,
            'user_id' => $creator->id,
            'action' => "Created group chat \"{$conversation->name}\"",
            'entity' => 'Conversation',
            'entity_id' => (string) $conversation->id,
        ]);

        broadcast(new ConversationCreated($conversation, $memberIds))->toOthers();

        return $conversation;
    }

    public function rename(Conversation $conversation, ?string $name): Conversation
    {
        return $this->conversations->update($conversation, ['name' => $name]);
    }

    public function addMembers(Conversation $conversation, array $userIds, User $actor): void
    {
        foreach (array_unique(array_map('intval', $userIds)) as $userId) {
            if ($userId === $actor->id) {
                continue;
            }

            if ($this->conversations->hasParticipantRecord($conversation, $userId)) {
                if (!$this->conversations->isActiveParticipant($conversation, $userId)) {
                    $this->conversations->reactivateParticipant($conversation, $userId, 'member');
                }
                continue;
            }

            $this->conversations->addParticipant($conversation, $userId, 'member');
        }

        broadcast(new ConversationCreated($conversation->fresh(), $userIds))->toOthers();
    }

    public function removeMember(Conversation $conversation, int $userId): void
    {
        $this->conversations->leave($conversation, $userId);
    }

    public function leave(Conversation $conversation, User $actor): void
    {
        $this->conversations->leave($conversation, $actor->id);
    }

    public function markRead(Conversation $conversation, User $actor, int $lastReadMessageId): void
    {
        $this->conversations->updateReadWatermark($conversation, $actor->id, $lastReadMessageId);
    }

    /** @return int[] */
    public function activeParticipantIds(Conversation $conversation): array
    {
        return $this->conversations->activeParticipantIds($conversation);
    }

    private function directKey(int $projectId, int $userA, int $userB): string
    {
        $min = min($userA, $userB);
        $max = max($userA, $userB);

        return "{$projectId}:{$min}:{$max}";
    }
}
