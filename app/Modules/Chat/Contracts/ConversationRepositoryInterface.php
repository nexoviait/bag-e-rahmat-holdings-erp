<?php

namespace App\Modules\Chat\Contracts;

use App\Models\Conversation;
use Illuminate\Support\Collection;

interface ConversationRepositoryInterface
{
    public function findOrFail(int $id): Conversation;

    public function findByDirectKey(string $directKey): ?Conversation;

    /** Conversations the given user actively participates in, within this project. */
    public function listForProjectAndUser(int $projectId, int $userId): Collection;

    /** Every conversation in the project — admins/super_admins see everything. */
    public function listForProject(int $projectId): Collection;

    public function create(array $attributes): Conversation;

    public function update(Conversation $conversation, array $attributes): Conversation;

    public function addParticipant(Conversation $conversation, int $userId, string $role): void;

    public function reactivateParticipant(Conversation $conversation, int $userId, string $role): void;

    public function hasParticipantRecord(Conversation $conversation, int $userId): bool;

    /** Soft-remove — sets left_at. Used both for a user leaving themselves and a group-admin removing someone. */
    public function leave(Conversation $conversation, int $userId): void;

    public function isActiveParticipant(Conversation $conversation, int $userId): bool;

    /** @return int[] */
    public function activeParticipantIds(Conversation $conversation): array;

    public function updateReadWatermark(Conversation $conversation, int $userId, int $lastReadMessageId): void;
}
