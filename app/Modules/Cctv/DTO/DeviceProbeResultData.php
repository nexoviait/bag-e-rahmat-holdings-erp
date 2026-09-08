<?php

namespace App\Modules\Cctv\DTO;

/**
 * Result of a "test connection" probe against a physical DVR — used by both
 * the manual Test Connection button and the periodic status-polling job.
 */
final readonly class DeviceProbeResultData
{
    public function __construct(
        public bool $reachable,
        public bool $authorized,
        public ?string $deviceType = null,
        public ?string $serialNumber = null,
        public ?string $errorMessage = null,
    ) {}

    public static function success(?string $deviceType, ?string $serialNumber): self
    {
        return new self(reachable: true, authorized: true, deviceType: $deviceType, serialNumber: $serialNumber);
    }

    public static function unauthorized(string $message): self
    {
        return new self(reachable: true, authorized: false, errorMessage: $message);
    }

    public static function unreachable(string $message): self
    {
        return new self(reachable: false, authorized: false, errorMessage: $message);
    }
}
