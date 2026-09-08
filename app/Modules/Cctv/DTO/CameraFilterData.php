<?php

namespace App\Modules\Cctv\DTO;

/**
 * Query filters for the camera index endpoint. A plain value object so the
 * repository's listVisibleTo() signature stays stable regardless of how many
 * query-string filters the API grows over time.
 */
final readonly class CameraFilterData
{
    public function __construct(
        public ?int $projectId = null,
        public ?int $deviceId = null,
        public ?string $status = null,
        public ?string $search = null,
        public bool $activeOnly = true,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            projectId: isset($data['project_id']) ? (int) $data['project_id'] : null,
            deviceId: isset($data['device_id']) ? (int) $data['device_id'] : null,
            status: $data['status'] ?? null,
            search: $data['q'] ?? null,
            activeOnly: !isset($data['include_inactive']),
        );
    }
}
