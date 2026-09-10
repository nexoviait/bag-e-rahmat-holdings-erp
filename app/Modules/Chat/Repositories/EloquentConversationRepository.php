<?php

namespace App\Modules\Chat\Repositories;

use App\Models\Conversation;
use App\Modules\Chat\Contracts\ConversationRepositoryInterface;
use Illuminate\Support\Collection;

final class EloquentConversationRepository implements ConversationRepositoryInterface
{
    public function findOrFail(int $id): Conversation
    {
        return Conversation::findOrFail($id);
    }

    public function findByDirectKey(string $directKey): ?Conversation
    {
        return Conversation::where('direct_key', $directKey)->first();
    }

    public function listForProjectAndUser(int $projectId, int $userId): Collection
    {
        return Conversation::where('project_id', $projectId)
            ->whereHas('activeParticipants', fn ($q) => $q->where('user_id', $userId))
            ->with([
                'activeParticipants.user:id,name,email,avatar_path,last_seen_at',
                'latestMessage.sender:id,name',
            ])
            // A correlated subquery, not a static withCount closure, because
            // the "unread since" threshold is THIS user's own watermark on
            // THIS conversation — a per-row value, not a shared constant.
            ->withCount(['messages as unread_count' => function ($q) use ($userId) {
                $q->whereRaw(
                    'messages.id > (select coalesce(max(cp.last_read_message_id), 0) '
                    .'from conversation_participants cp '
                    .'where cp.conversation_id = messages.conversation_id and cp.user_id = ?)',
                    [$userId]
                );
            }])
            ->get()
            ->sortByDesc(fn (Conversation $c) => optional($c->latestMessage)->created_at ?? $c->created_at)
            ->values();
    }

    public function listForProject(int $projectId): Collection
    {
        return Conversation::where('project_id', $projectId)
            ->with([
                'activeParticipants.user:id,name,email,avatar_path,last_seen_at',
                'latestMessage.sender:id,name',
            ])
            ->withCount('messages')
            ->get()
            ->sortByDesc(fn (Conversation $c) => optional($c->latestMessage)->created_at ?? $c->created_at)
            ->values();
    }

    public function create(array $attributes): Conversation
    {
        return Conversation::create($attributes);
    }

    public function update(Conversation $conversation, array $attributes): Conversation
    {
        $conversation->update($attributes);

        return $conversation->fresh();
    }

    public function addParticipant(Conversation $conversation, int $userId, string $role): void
    {
        $conversation->participants()->create([
            'user_id' => $userId,
            'role' => $role,
            'joined_at' => now(),
        ]);
    }

    public function reactivateParticipant(Conversation $conversation, int $userId, string $role): void
    {
        $conversation->participants()->where('user_id', $userId)->update([
            'role' => $role,
            'left_at' => null,
            'joined_at' => now(),
        ]);
    }

    public function hasParticipantRecord(Conversation $conversation, int $userId): bool
    {
        return $conversation->participants()->where('user_id', $userId)->exists();
    }

    public function leave(Conversation $conversation, int $userId): void
    {
        $conversation->participants()->where('user_id', $userId)->whereNull('left_at')->update([
            'left_at' => now(),
        ]);
    }

    public function isActiveParticipant(Conversation $conversation, int $userId): bool
    {
        return $conversation->participants()
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->exists();
    }

    public function activeParticipantIds(Conversation $conversation): array
    {
        return $conversation->participants()
            ->whereNull('left_at')
            ->pluck('user_id')
            ->all();
    }

    public function updateReadWatermark(Conversation $conversation, int $userId, int $lastReadMessageId): void
    {
        $conversation->participants()->where('user_id', $userId)->update([
            'last_read_message_id' => $lastReadMessageId,
            'last_read_at' => now(),
        ]);
    }
}
