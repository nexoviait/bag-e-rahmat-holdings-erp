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

    public function toModelAttributes(): array
    {
        return [
            'project_id' => $this->projectId,
            'name' => $this->name,
            'unit' => $this->unit,
            'reorder_level' => $this->reorderLevel,
            'notes' => $this->notes,
            'is_active' => $this->isActive,
        ];
    }
}
