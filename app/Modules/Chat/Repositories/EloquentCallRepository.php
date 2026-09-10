<?php

namespace App\Modules\Chat\Repositories;

use App\Models\Call;
use App\Modules\Chat\Contracts\CallRepositoryInterface;
use Illuminate\Support\Collection;

final class EloquentCallRepository implements CallRepositoryInterface
{
    public function findOrFail(int $id): Call
    {
        return Call::findOrFail($id);
    }

    public function findActiveForConversation(int $conversationId): ?Call
    {
        return Call::where('conversation_id', $conversationId)
            ->whereIn('status', ['ringing', 'ongoing'])
            ->latest('id')
            ->first();
    }

    public function create(array $attributes): Call
    {
        return Call::create($attributes);
    }

    public function update(Call $call, array $attributes): Call
    {
        $call->update($attributes);

        return $call->fresh();
    }

    public function addParticipant(Call $call, int $userId, string $status): void
    {
        $call->participants()->create([
            'user_id' => $userId,
            'status' => $status,
            'joined_at' => $status === 'joined' ? now() : null,
        ]);
    }

    public function updateParticipant(Call $call, int $userId, array $attributes): void
    {
        $call->participants()->where('user_id', $userId)->update($attributes);
    }

    public function activeParticipantIds(Call $call): array
    {
        return $call->participants()->whereIn('status', ['ringing', 'joined'])->pluck('user_id')->all();
    }

    public function joinedParticipantIds(Call $call): array
    {
        return $call->participants()->where('status', 'joined')->pluck('user_id')->all();
    }

    public function isParticipant(Call $call, int $userId): bool
    {
        return $call->participants()->where('user_id', $userId)->exists();
    }

    public function findStaleRinging(int $olderThanSeconds): Collection
    {
        return Call::where('status', 'ringing')
            ->where('created_at', '<', now()->subSeconds($olderThanSeconds))
            ->get();
    }
}
