<?php

namespace Tests\Unit\Cctv;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use App\Modules\Cctv\Support\DahuaUrlBuilder;
use PHPUnit\Framework\TestCase;

class DahuaUrlBuilderTest extends TestCase
{
    private function device(array $overrides = []): DvrDevice
    {
        // Plain attribute assignment only — no DB, no encrypted-cast access — so
        // this stays a true unit test with no Laravel app bootstrap required.
        return new DvrDevice(array_merge([
            'ip_address' => '192.168.1.108',
            'http_port' => 80,
            'rtsp_port' => 554,
            'username' => 'admin',
        ], $overrides));
    }

    public function test_builds_standard_rtsp_url(): void
    {
        $url = DahuaUrlBuilder::rtsp($this->device(), channelNumber: 3, plainPassword: 'plainpass', subtype: CameraChannel::QUALITY_SUB);

        $this->assertSame(
            'rtsp://admin:plainpass@192.168.1.108:554/cam/realmonitor?channel=3&subtype=1',
            $url
        );
    }

    public function test_main_stream_uses_subtype_zero(): void
    {
        $url = DahuaUrlBuilder::rtsp($this->device(), channelNumber: 1, plainPassword: 'x', subtype: CameraChannel::QUALITY_MAIN);

        $this->assertStringContainsString('subtype=0', $url);
    }

    public function test_encodes_special_characters_in_password(): void
    {
        // Dahua's own default-generated passwords commonly contain '@', '#', ':' —
        // an unencoded '@' would be parsed as the credentials/host separator and
        // silently corrupt the URL, connecting with the wrong password entirely.
        $url = DahuaUrlBuilder::rtsp($this->device(), channelNumber: 1, plainPassword: 'p@ss:w#rd', subtype: 1);

        $this->assertStringContainsString('p%40ss%3Aw%23rd', $url);
        $this->assertStringNotContainsString('p@ss:w#rd', $url);
    }

    public function test_encodes_special_characters_in_username(): void
    {
        $url = DahuaUrlBuilder::rtsp($this->device(['username' => 'us@er']), channelNumber: 1, plainPassword: 'x', subtype: 1);

        $this->assertStringContainsString('us%40er', $url);
    }

    public function test_snapshot_cgi_url_uses_the_one_based_channel_number_directly(): void
    {
        // Verified against real DH-XVR1B16H-I hardware — this CGI is 1-based
        // on this firmware (channel=0 returns HTTP 400).
        $url = DahuaUrlBuilder::snapshotCgiUrl($this->device(), channelNumber: 5);

        $this->assertSame('http://192.168.1.108:80/cgi-bin/snapshot.cgi?channel=5', $url);
    }

    public function test_device_type_and_serial_cgi_urls(): void
    {
        $device = $this->device(['http_port' => 8080]);

        $this->assertSame(
            'http://192.168.1.108:8080/cgi-bin/magicBox.cgi?action=getDeviceType',
            DahuaUrlBuilder::deviceTypeCgiUrl($device)
        );
        $this->assertSame(
            'http://192.168.1.108:8080/cgi-bin/magicBox.cgi?action=getSerialNo',
            DahuaUrlBuilder::serialNoCgiUrl($device)
        );
    }

    public function test_redacts_credentials_for_logging(): void
    {
        $redacted = DahuaUrlBuilder::redact('rtsp://admin:s3cr3t@192.168.1.108:554/cam/realmonitor?channel=1');

        $this->assertSame('rtsp://***:***@192.168.1.108:554/cam/realmonitor?channel=1', $redacted);
        $this->assertStringNotContainsString('s3cr3t', $redacted);
    }
}
