<?php

namespace App\Modules\Cctv\DTO;

/**
 * Validated input for updating a CameraChannel's editable fields (rename,
 * relocate, activate/deactivate). Channel number and device are immutable
 * post-creation — those come from device sync, not manual edit.
 */
final readonly class CameraChannelData
{
    public function __construct(
        public string $cameraName,
        public ?string $location,
        public bool $isActive,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            cameraName: $data['camera_name'],
            location: $data['location'] ?? null,
            isActive: (bool) ($data['is_active'] ?? true),
        );
    }

    public function toModelAttributes(): array
    {
        return [
            'camera_name' => $this->cameraName,
            'location' => $this->location,
            'is_active' => $this->isActive,
        ];
    }
}
