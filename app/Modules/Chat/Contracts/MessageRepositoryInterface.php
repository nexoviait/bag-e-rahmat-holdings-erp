<?php

namespace App\Modules\Chat\Contracts;

use App\Models\Message;
use Illuminate\Support\Collection;

interface MessageRepositoryInterface
{
    public function findOrFail(int $id): Message;

    /**
     * A page of messages, oldest-first, for infinite-scroll-upward loading.
     * $beforeId (exclusive) paginates further into the past; null returns the
     * most recent $limit messages.
     */
    public function forConversation(int $conversationId, ?int $beforeId, int $limit): Collection;

    public function create(array $attributes): Message;

    public function latestForConversation(int $conversationId): ?Message;
}
