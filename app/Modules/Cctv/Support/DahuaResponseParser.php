<?php

namespace App\Modules\Cctv\Support;

use App\Modules\Cctv\DTO\DiscoveredChannelData;

/**
 * Pure parsing of Dahua's CGI text response format — flat "key=value" lines
 * (CRLF-separated), e.g.:
 *
 *   table.ChannelTitle[0].Name=Front Door
 *   table.ChannelTitle[1].Name=Parking Lot
 *
 * No I/O — takes the raw response body as a string, returns structured data.
 * Kept separate from DahuaHttpGateway so firmware response-shape quirks are a
 * one-file fix that can't ripple into services, policies, or the frontend.
 */
final class DahuaResponseParser
{
    /**
     * Parses a flat "key=value" CGI body into an associative array.
     * Tolerant of \r\n, \n, and stray blank lines.
     *
     * @return array<string, string>
     */
    public static function toKeyValueMap(string $body): array
    {
        $map = [];

        foreach (preg_split('/\r\n|\r|\n/', trim($body)) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || !str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $map[trim($key)] = trim($value);
        }

        return $map;
    }

    /** Extracts the device type string from a getDeviceType response, e.g. "type=IPC". */
    public static function deviceType(string $body): ?string
    {
        return self::toKeyValueMap($body)['type'] ?? null;
    }

    /** Extracts the serial number from a getSerialNo response, e.g. "sn=1234567890ABCDEF". */
    public static function serialNumber(string $body): ?string
    {
        return self::toKeyValueMap($body)['sn'] ?? null;
    }

    /**
     * Parses "table.ChannelTitle[N].Name=..." lines into a 1-indexed list of
     * discovered channels, sorted by channel number.
     *
     * @return DiscoveredChannelData[]
     */
    public static function channelTitles(string $body): array
    {
        $channels = [];

        foreach (self::toKeyValueMap($body) as $key => $value) {
            if (preg_match('/^table\.ChannelTitle\[(\d+)\]\.Name$/', $key, $m)) {
                $zeroBasedIndex = (int) $m[1];
                $channels[] = new DiscoveredChannelData(
                    channelNumber: $zeroBasedIndex + 1,
                    name: $value !== '' ? $value : ('Camera ' . ($zeroBasedIndex + 1)),
                );
            }
        }

        usort($channels, fn (DiscoveredChannelData $a, DiscoveredChannelData $b) => $a->channelNumber <=> $b->channelNumber);

        return $channels;
    }
}
