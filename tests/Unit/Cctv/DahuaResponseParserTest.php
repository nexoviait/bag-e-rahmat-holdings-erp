<?php

namespace Tests\Unit\Cctv;

use App\Modules\Cctv\Support\DahuaResponseParser;
use PHPUnit\Framework\TestCase;

class DahuaResponseParserTest extends TestCase
{
    public function test_parses_device_type(): void
    {
        $this->assertSame('NVR', DahuaResponseParser::deviceType("type=NVR\r\n"));
    }

    public function test_device_type_returns_null_when_missing(): void
    {
        $this->assertNull(DahuaResponseParser::deviceType("foo=bar\r\n"));
    }

    public function test_parses_serial_number(): void
    {
        $this->assertSame('1234567890ABCDEF', DahuaResponseParser::serialNumber("sn=1234567890ABCDEF\r\n"));
    }

    public function test_parses_channel_titles_in_order(): void
    {
        $body = "table.ChannelTitle[0].Name=Front Door\r\n"
            . "table.ChannelTitle[2].Name=Parking Lot\r\n"
            . "table.ChannelTitle[1].Name=Back Gate\r\n";

        $channels = DahuaResponseParser::channelTitles($body);

        $this->assertCount(3, $channels);
        // 0-based device index -> 1-based channel_number, and sorted by number
        // regardless of the order lines appeared in the response.
        $this->assertSame(1, $channels[0]->channelNumber);
        $this->assertSame('Front Door', $channels[0]->name);
        $this->assertSame(2, $channels[1]->channelNumber);
        $this->assertSame('Back Gate', $channels[1]->name);
        $this->assertSame(3, $channels[2]->channelNumber);
        $this->assertSame('Parking Lot', $channels[2]->name);
    }

    public function test_channel_title_falls_back_to_default_name_when_blank(): void
    {
        $channels = DahuaResponseParser::channelTitles("table.ChannelTitle[4].Name=\r\n");

        $this->assertSame('Camera 5', $channels[0]->name);
    }

    public function test_tolerates_blank_lines_and_lf_only_line_endings(): void
    {
        $body = "type=IPC\n\nsn=ABC123\n";

        $map = DahuaResponseParser::toKeyValueMap($body);

        $this->assertSame('IPC', $map['type']);
        $this->assertSame('ABC123', $map['sn']);
    }

    public function test_empty_body_returns_empty_channel_list(): void
    {
        $this->assertSame([], DahuaResponseParser::channelTitles(''));
    }
}
