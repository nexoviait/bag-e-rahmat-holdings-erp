<?php

namespace App\Modules\Chat\Repositories;

use App\Models\Message;
use App\Modules\Chat\Contracts\MessageRepositoryInterface;
use Illuminate\Support\Collection;

final class EloquentMessageRepository implements MessageRepositoryInterface
{
    public function findOrFail(int $id): Message
    {
        return Message::findOrFail($id);
    }

    public function forConversation(int $conversationId, ?int $beforeId, int $limit): Collection
    {
        $query = Message::where('conversation_id', $conversationId)
            ->with('sender:id,name,avatar_path')
            ->orderBy('id', 'desc');

        if ($beforeId !== null) {
            $query->where('id', '<', $beforeId);
        }

        // Fetched newest-first (so LIMIT keeps the most recent page), then
        // reversed back to oldest-first for the thread UI to render top-to-bottom.
        return $query->limit($limit)->get()->reverse()->values();
    }

    public function create(array $attributes): Message
    {
        return Message::create($attributes);
    }

    public function latestForConversation(int $conversationId): ?Message
    {
        return Message::where('conversation_id', $conversationId)->latest('id')->first();
    }
}
