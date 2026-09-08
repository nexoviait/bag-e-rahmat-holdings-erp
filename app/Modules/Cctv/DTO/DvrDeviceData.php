<?php

namespace App\Modules\Cctv\DTO;

/**
 * Validated input for creating or updating a DvrDevice. Built by the controller
 * from a FormRequest's validated() array — keeps the Service layer's method
 * signature stable even if the HTTP request shape changes.
 */
final readonly class DvrDeviceData
{
    public function __construct(
        public int $projectId,
        public string $deviceName,
        public string $brand,
        public ?string $model,
        public string $ipAddress,
        public int $httpPort,
        public int $rtspPort,
        public string $username,
        public ?string $password,
        public ?string $serialNumber,
        public int $channelCount,
        public string $visibility,
        public bool $isActive,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            projectId: (int) $data['project_id'],
            deviceName: $data['device_name'],
            brand: $data['brand'] ?? 'Dahua',
            model: $data['model'] ?? null,
            ipAddress: $data['ip_address'],
            httpPort: (int) ($data['http_port'] ?? 80),
            rtspPort: (int) ($data['rtsp_port'] ?? 554),
            username: $data['username'],
            password: $data['password'] ?? null,
            serialNumber: $data['serial_number'] ?? null,
            channelCount: (int) ($data['channel_count'] ?? 16),
            visibility: $data['visibility'] ?? 'all',
            isActive: (bool) ($data['is_active'] ?? true),
        );
    }

    /**
     * Attributes for Eloquent create()/update(). Omits 'password' when null so an
     * update request that doesn't include a new password never overwrites the
     * existing encrypted credential with an empty string.
     */
    public function toModelAttributes(): array
    {
        $attributes = [
            'project_id' => $this->projectId,
            'device_name' => $this->deviceName,
            'brand' => $this->brand,
            'model' => $this->model,
            'ip_address' => $this->ipAddress,
            'http_port' => $this->httpPort,
            'rtsp_port' => $this->rtspPort,
            'username' => $this->username,
            'serial_number' => $this->serialNumber,
            'channel_count' => $this->channelCount,
            'visibility' => $this->visibility,
            'is_active' => $this->isActive,
        ];

        if ($this->password !== null && $this->password !== '') {
            $attributes['password'] = $this->password;
        }

        return $attributes;
    }
}
