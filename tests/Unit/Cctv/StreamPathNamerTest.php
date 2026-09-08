<?php

namespace Tests\Unit\Cctv;

use App\Models\CameraChannel;
use App\Modules\Cctv\Support\StreamPathNamer;
use PHPUnit\Framework\TestCase;

class StreamPathNamerTest extends TestCase
{
    public function test_generates_stable_deterministic_path(): void
    {
        $this->assertSame('dvr7-ch4', StreamPathNamer::forChannel(7, 4));
    }

    public function test_default_subtype_is_mainstream_and_matches_bare_path(): void
    {
        $this->assertSame(
            StreamPathNamer::forChannel(7, 4),
            StreamPathNamer::forChannel(7, 4, CameraChannel::QUALITY_MAIN)
        );
    }

    public function test_substream_path_is_distinct_and_suffixed(): void
    {
        $this->assertSame('dvr7-ch4-sub', StreamPathNamer::forChannel(7, 4, CameraChannel::QUALITY_SUB));
        $this->assertNotSame(
            StreamPathNamer::forChannel(7, 4, CameraChannel::QUALITY_MAIN),
            StreamPathNamer::forChannel(7, 4, CameraChannel::QUALITY_SUB)
        );
    }

    public function test_same_inputs_always_produce_same_path(): void
    {
        $this->assertSame(
            StreamPathNamer::forChannel(1, 1),
            StreamPathNamer::forChannel(1, 1)
        );
    }

    public function test_different_devices_never_collide_on_the_same_channel_number(): void
    {
        $this->assertNotSame(
            StreamPathNamer::forChannel(1, 1),
            StreamPathNamer::forChannel(2, 1)
        );
    }
}
