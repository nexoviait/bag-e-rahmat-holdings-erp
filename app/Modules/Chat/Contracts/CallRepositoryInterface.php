<?php

namespace App\Modules\Chat\Contracts;

use App\Models\Call;
use Illuminate\Support\Collection;

interface CallRepositoryInterface
{
    public function findOrFail(int $id): Call;

    /** An active (ringing or ongoing) call for this conversation, if any — used to dedupe a second "initiate" attempt. */
    public function findActiveForConversation(int $conversationId): ?Call;

    public function create(array $attributes): Call;

    public function update(Call $call, array $attributes): Call;

    public function addParticipant(Call $call, int $userId, string $status): void;

    public function updateParticipant(Call $call, int $userId, array $attributes): void;

    /** @return int[] user ids currently 'ringing' or 'joined' — i.e. still meaningfully part of the call. */
    public function activeParticipantIds(Call $call): array;

    /** @return int[] user ids with status 'joined' specifically. */
    public function joinedParticipantIds(Call $call): array;

    public function isParticipant(Call $call, int $userId): bool;

    /** Calls still 'ringing' and older than $olderThanSeconds — for the stale-call sweep. */
    public function findStaleRinging(int $olderThanSeconds): Collection;
}
