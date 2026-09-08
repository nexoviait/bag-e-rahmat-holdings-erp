<?php

namespace App\Modules\Cctv\Support;

/**
 * Machine-readable error codes returned in every CCTV API error response's `code`
 * field, so the frontend can render the right friendly message per failure mode
 * instead of pattern-matching on human-readable text.
 */
enum CctvErrorCode: string
{
    case DEVICE_UNREACHABLE = 'DEVICE_UNREACHABLE';
    case DEVICE_UNAUTHORIZED = 'DEVICE_UNAUTHORIZED';
    case CAMERA_OFFLINE = 'CAMERA_OFFLINE';
    case STREAM_TIMEOUT = 'STREAM_TIMEOUT';
    case MEDIAMTX_UNAVAILABLE = 'MEDIAMTX_UNAVAILABLE';
    case MEDIAMTX_REJECTED = 'MEDIAMTX_REJECTED';

    public function httpStatus(): int
    {
        return match ($this) {
            self::DEVICE_UNREACHABLE => 503,
            self::DEVICE_UNAUTHORIZED => 502,
            self::CAMERA_OFFLINE => 503,
            self::STREAM_TIMEOUT => 504,
            self::MEDIAMTX_UNAVAILABLE => 503,
            self::MEDIAMTX_REJECTED => 502,
        };
    }
}
