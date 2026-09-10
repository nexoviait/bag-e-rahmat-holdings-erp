<?php

namespace App\Modules\Chat\DTO;

final readonly class MessageData
{
    public function __construct(
        public int $conversationId,
        public string $type,
        public ?string $body,
        public ?int $replyToMessageId,
        public ?string $attachmentPath = null,
        public ?string $attachmentName = null,
        public ?string $attachmentMime = null,
        public ?int $attachmentSize = null,
        public ?int $attachmentDurationMs = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            conversationId: (int) $data['conversation_id'],
            type: $data['type'] ?? 'text',
            body: $data['body'] ?? null,
            replyToMessageId: isset($data['reply_to_message_id']) ? (int) $data['reply_to_message_id'] : null,
        );
    }

    public function toModelAttributes(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'type' => $this->type,
            'body' => $this->body,
            'reply_to_message_id' => $this->replyToMessageId,
            'attachment_path' => $this->attachmentPath,
            'attachment_name' => $this->attachmentName,
            'attachment_mime' => $this->attachmentMime,
            'attachment_size' => $this->attachmentSize,
            'attachment_duration_ms' => $this->attachmentDurationMs,
        ];
    }

    public function withAttachment(array $attrs): self
    {
        return new self(
            conversationId: $this->conversationId,
            type: $attrs['type'] ?? $this->type,
            body: $this->body,
            replyToMessageId: $this->replyToMessageId,
            attachmentPath: $attrs['attachment_path'],
            attachmentName: $attrs['attachment_name'],
            attachmentMime: $attrs['attachment_mime'],
            attachmentSize: $attrs['attachment_size'],
            attachmentDurationMs: $attrs['attachment_duration_ms'] ?? null,
        );
    }
}
