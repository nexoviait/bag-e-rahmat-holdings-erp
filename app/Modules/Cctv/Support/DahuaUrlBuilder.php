<?php

namespace App\Modules\Cctv\Support;

use App\Models\CameraChannel;
use App\Models\DvrDevice;

/**
 * Pure URL construction for Dahua RTSP streams and CGI (HTTP API) endpoints.
 * No I/O, no DB access — takes plain values in, returns strings out, so it's
 * trivially unit-testable without mocking a database or HTTP client.
 */
final class DahuaUrlBuilder
{
    /**
     * Dahua's standard "realmonitor" RTSP path. subtype 0 = main stream, 1 = sub stream.
     *
     * Username/password are URL-encoded — Dahua's own default-generated passwords
     * frequently contain '@', '#', ':', which would otherwise silently corrupt the
     * URL (e.g. an unencoded '@' in the password is parsed as the credentials/host
     * separator, and the RTSP client connects with the wrong password entirely).
     */
    public static function rtsp(DvrDevice $device, int $channelNumber, string $plainPassword, int $subtype = CameraChannel::QUALITY_SUB): string
    {
        $user = rawurlencode($device->username);
        $pass = rawurlencode($plainPassword);

        return sprintf(
            'rtsp://%s:%s@%s:%d/cam/realmonitor?channel=%d&subtype=%d',
            $user,
            $pass,
            $device->ip_address,
            $device->rtsp_port,
            $channelNumber,
            $subtype
        );
    }

    /** Base "http://ip:port" prefix shared by every CGI endpoint below. */
    public static function httpBase(DvrDevice $device): string
    {
        return sprintf('http://%s:%d', $device->ip_address, $device->http_port);
    }

    /** Device identity probe — used by test-connection. */
    public static function deviceTypeCgiUrl(DvrDevice $device): string
    {
        return self::httpBase($device) . '/cgi-bin/magicBox.cgi?action=getDeviceType';
    }

    /** Serial number probe — used by test-connection. */
    public static function serialNoCgiUrl(DvrDevice $device): string
    {
        return self::httpBase($device) . '/cgi-bin/magicBox.cgi?action=getSerialNo';
    }

    /** Channel title/name enumeration — used by channel discovery / sync-cameras. */
    public static function channelTitleCgiUrl(DvrDevice $device): string
    {
        return self::httpBase($device) . '/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle';
    }

    /**
     * Single-frame JPEG snapshot for a given channel. Verified against real
     * DH-XVR1B16H-I hardware: this CGI takes the 1-based channel_number
     * directly — channel=0 returns HTTP 400 on this firmware, channel=1 (for
     * the first channel) returns 200. (An earlier assumption that this
     * endpoint was 0-based, matching some other Dahua CGI calls, was wrong
     * for this device and silently marked every viewed camera offline.)
     */
    public static function snapshotCgiUrl(DvrDevice $device, int $channelNumber): string
    {
        return self::httpBase($device) . "/cgi-bin/snapshot.cgi?channel={$channelNumber}";
    }

    /**
     * Redacts credentials from a source URL for safe logging — replaces
     * "user:pass@" with "***:***@" so nothing sensitive ever lands in laravel.log.
     */
    public static function redact(string $urlWithCredentials): string
    {
        return (string) preg_replace('#://[^@/]+@#', '://***:***@', $urlWithCredentials);
    }
}
