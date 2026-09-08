<?php

namespace App\Modules\Cctv\Support;

use App\Models\CameraChannel;

/**
 * Generates the stable MediaMTX path name stored in camera_channels.stream_path.
 * Pure function — deterministic per (device id, channel number), so re-syncing a
 * device's channels never changes an already-playing camera's path.
 *
 * Matches the convention already used by CctvDemoSeeder ("dvr{id}-ch{n}") so
 * seeded and sync-created cameras look identical.
 *
 * The bare path (no suffix) means mainstream — this is the value already
 * persisted in camera_channels.stream_path for every existing camera, so it's
 * defined that way here rather than migrated. The substream variant is derived
 * at request time only (never persisted) by appending "-sub", used for grid
 * tiles to save bandwidth while fullscreen playback pulls the mainstream path.
 */
final class StreamPathNamer
{
    public static function forChannel(int $dvrDeviceId, int $channelNumber, int $subtype = CameraChannel::QUALITY_MAIN): string
    {
        $base = "dvr{$dvrDeviceId}-ch{$channelNumber}";

        return $subtype === CameraChannel::QUALITY_SUB ? "{$base}-sub" : $base;
    }
}
