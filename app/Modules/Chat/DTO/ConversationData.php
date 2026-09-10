<?php

namespace App\Modules\Chat\DTO;

final readonly class ConversationData
{
    /** @param int[] $memberUserIds Other participants besides the creator. */
    public function __construct(
        public int $projectId,
        public string $type,
        public ?string $name,
        public array $memberUserIds,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            projectId: (int) $data['project_id'],
            type: $data['type'],
            name: $data['name'] ?? null,
            memberUserIds: array_values(array_unique(array_map('intval', $data['member_user_ids'] ?? []))),
        );
    }
}
