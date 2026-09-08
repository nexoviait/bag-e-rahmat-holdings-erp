<?php

namespace App\Modules\Cctv\Services\Gateways;

use App\Models\DvrDevice;
use App\Modules\Cctv\Contracts\DvrGatewayInterface;
use App\Modules\Cctv\DTO\DeviceProbeResultData;
use App\Modules\Cctv\Exceptions\DvrUnauthorizedException;
use App\Modules\Cctv\Exceptions\DvrUnreachableException;
use App\Modules\Cctv\Support\DahuaResponseParser;
use App\Modules\Cctv\Support\DahuaUrlBuilder;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Live implementation of DvrGatewayInterface — talks to a real Dahua DVR/XVR over
 * its HTTP CGI API. Dahua devices require HTTP Digest authentication (not Basic).
 *
 * Endpoints and response shapes here are best-understanding-at-build-time for the
 * DH-XVR1B16H-I; verify against real hardware with:
 *   curl --digest -u admin:pass "http://<dvr-ip>/cgi-bin/magicBox.cgi?action=getDeviceType"
 * and adjust DahuaResponseParser if the firmware's actual response differs — that
 * is a two-file fix (this gateway + the parser), isolated from services/policies.
 */
final class DahuaHttpGateway implements DvrGatewayInterface
{
    private const CONNECT_TIMEOUT = 3;
    private const REQUEST_TIMEOUT = 6;

    public function testConnection(DvrDevice $device): DeviceProbeResultData
    {
        try {
            $password = $device->plainPassword();
        } catch (DecryptException) {
            return DeviceProbeResultData::unauthorized(
                'Stored credentials could not be decrypted (APP_KEY may have changed). Re-enter the device password.'
            );
        }

        try {
            $response = $this->client($device, $password)->get(DahuaUrlBuilder::deviceTypeCgiUrl($device));

            if ($response->status() === 401) {
                return DeviceProbeResultData::unauthorized('The recorder rejected the saved username or password.');
            }

            if ($response->failed()) {
                return DeviceProbeResultData::unauthorized(
                    "The recorder responded with an unexpected error (HTTP {$response->status()})."
                );
            }

            $deviceType = DahuaResponseParser::deviceType($response->body());

            $serialResponse = $this->client($device, $password)->get(DahuaUrlBuilder::serialNoCgiUrl($device));
            $serialNumber = $serialResponse->successful()
                ? DahuaResponseParser::serialNumber($serialResponse->body())
                : null;

            return DeviceProbeResultData::success($deviceType, $serialNumber);
        } catch (ConnectionException $e) {
            Log::warning('DVR connection test failed', [
                'device_id' => $device->id,
                'ip' => $device->ip_address,
                'error' => $e->getMessage(),
            ]);

            return DeviceProbeResultData::unreachable(
                "Cannot reach the recorder at {$device->ip_address}. Check that it's powered on and reachable from the server network."
            );
        }
    }

    public function discoverChannels(DvrDevice $device): array
    {
        $password = $this->resolvePasswordOrFail($device);

        try {
            $response = $this->client($device, $password)->get(DahuaUrlBuilder::channelTitleCgiUrl($device));

            if ($response->status() === 401) {
                throw new DvrUnauthorizedException();
            }

            if ($response->successful()) {
                return DahuaResponseParser::channelTitles($response->body());
            }
        } catch (ConnectionException $e) {
            throw new DvrUnreachableException(previous: $e);
        }

        throw new DvrUnreachableException("The recorder responded with an unexpected error while listing channels.");
    }

    public function fetchSnapshot(DvrDevice $device, int $channelNumber): string
    {
        $password = $this->resolvePasswordOrFail($device);

        try {
            $response = $this->client($device, $password)->get(DahuaUrlBuilder::snapshotCgiUrl($device, $channelNumber));
        } catch (ConnectionException $e) {
            throw new DvrUnreachableException(previous: $e);
        }

        if ($response->status() === 401) {
            throw new DvrUnauthorizedException();
        }

        if ($response->failed()) {
            throw new DvrUnreachableException(
                "The recorder could not provide a snapshot for channel {$channelNumber} (HTTP {$response->status()})."
            );
        }

        return $response->body();
    }

    private function resolvePasswordOrFail(DvrDevice $device): string
    {
        try {
            return $device->plainPassword();
        } catch (DecryptException) {
            throw new DvrUnauthorizedException(
                'Stored credentials could not be decrypted (APP_KEY may have changed). Re-enter the device password.'
            );
        }
    }

    private function client(DvrDevice $device, string $password)
    {
        return Http::connectTimeout(self::CONNECT_TIMEOUT)
            ->timeout(self::REQUEST_TIMEOUT)
            ->withDigestAuth($device->username, $password);
    }
}
