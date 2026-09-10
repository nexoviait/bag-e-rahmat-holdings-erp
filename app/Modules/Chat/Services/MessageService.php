<?php

namespace App\Modules\Chat\Services;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Modules\Chat\Contracts\ConversationRepositoryInterface;
use App\Modules\Chat\Contracts\MessageRepositoryInterface;
use App\Modules\Chat\DTO\MessageData;
use App\Modules\Chat\Events\MessageRead;
use App\Modules\Chat\Events\MessageSent;
use Illuminate\Support\Collection;

final class MessageService
{
    public function __construct(
        private readonly MessageRepositoryInterface $messages,
        private readonly ConversationRepositoryInterface $conversations,
    ) {}

    public function listForConversation(int $conversationId, ?int $beforeId, int $limit = 30): Collection
    {
        return $this->messages->forConversation($conversationId, $beforeId, $limit);
    }

    public function find(int $id): Message
    {
        return $this->messages->findOrFail($id);
    }

    public function send(Conversation $conversation, User $sender, MessageData $data): Message
    {
        $message = $this->messages->create([
            ...$data->toModelAttributes(),
            'sender_id' => $sender->id,
        ]);
        $message->load('sender:id,name,avatar_path');

        // The sender obviously "read" the message they just sent — advances
        // their own watermark so their own unread count never counts it.
        $this->conversations->updateReadWatermark($conversation, $sender->id, $message->id);

        $recipientIds = array_values(array_diff(
            $this->conversations->activeParticipantIds($conversation),
            [$sender->id]
        ));

        // broadcast()->toOthers(), not event() — toOthers() reads the
        // X-Socket-Id header (see lib/api.ts's request interceptor) to skip
        // re-delivering this to the sender's own tab, which already rendered
        // the message optimistically from this HTTP response. event() alone
        // has no toOthers() to chain — it's only exposed on broadcast()'s
        // PendingBroadcast return value.
        broadcast(new MessageSent($message, $recipientIds, $conversation->project_id))->toOthers();

        return $message;
    }

    public function markRead(Conversation $conversation, User $actor): ?Message
    {
        $latest = $this->messages->latestForConversation($conversation->id);
        if (!$latest) {
            return null;
        }

        $this->conversations->updateReadWatermark($conversation, $actor->id, $latest->id);

        $participant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $actor->id)
            ->first();

        if ($participant) {
            broadcast(new MessageRead($participant))->toOthers();
        }

        return $latest;
    }
}
