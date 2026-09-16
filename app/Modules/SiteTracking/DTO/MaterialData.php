<?php

namespace App\Modules\SiteTracking\DTO;

final readonly class MaterialData
{
    public function __construct(
        public int $projectId,
        public string $name,
        public string $unit,
        public ?float $reorderLevel,
        public ?string $notes,
        public bool $isActive,
        public ?string $attachmentPath = null,
        public ?string $attachmentName = null,
        public ?string $attachmentMime = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            projectId: (int) $data['project_id'],
            name: $data['name'],
            unit: $data['unit'],
            reorderLevel: isset($data['reorder_level']) && $data['reorder_level'] !== '' ? (float) $data['reorder_level'] : null,
            notes: $data['notes'] ?? null,
            isActive: (bool) ($data['is_active'] ?? true),
        );
    }

    /** Applied after fromArray() once an uploaded attachment has actually been stored — see handleAttachmentUpload(). */
    public function withAttachment(array $attrs): self
    {
        return new self(
            projectId: $this->projectId,
            name: $this->name,
            unit: $this->unit,
            reorderLevel: $this->reorderLevel,
            notes: $this->notes,
            isActive: $this->isActive,
            attachmentPath: $attrs['attachment_path'],
            attachmentName: $attrs['attachment_name'],
            attachmentMime: $attrs['attachment_mime'],
        );
    }

    public function toModelAttributes(): array
    {
        $attributes = [
            'project_id' => $this->projectId,
            'name' => $this->name,
            'unit' => $this->unit,
            'reorder_level' => $this->reorderLevel,
            'notes' => $this->notes,
            'is_active' => $this->isActive,
        ];

        // Only present (and only overwritten) when a new attachment was
        // actually uploaded this request — see MaterialController::update(),
        // which otherwise leaves an existing attachment untouched.
        if ($this->attachmentPath !== null) {
            $attributes['attachment_path'] = $this->attachmentPath;
            $attributes['attachment_name'] = $this->attachmentName;
            $attributes['attachment_mime'] = $this->attachmentMime;
        }

        return $attributes;
    }
}
