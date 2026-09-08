<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Models\CameraChannel;
use App\Modules\Cctv\Exceptions\CctvException;
use App\Modules\Cctv\Http\Requests\LiveStreamRequest;
use App\Modules\Cctv\Services\CameraChannelService;
use App\Modules\Cctv\Services\LiveStreamService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Throwable;

class StreamController extends CctvController
{
    public function __construct(
        private readonly CameraChannelService $cameras,
        private readonly LiveStreamService $stream,
    ) {}

    /** POST /cctv/live/{id} — mints a short-lived WebRTC/HLS stream URL pair. Never returns an IP, RTSP URL, or credential. */
    public function mint(LiveStreamRequest $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('stream', $camera);

            $subtype = $request->validated('quality') === 'sub' ? CameraChannel::QUALITY_SUB : CameraChannel::QUALITY_MAIN;

            $result = $this->stream->mintLiveStream($camera, $request->user(), $subtype);

            return response()->json($result);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this camera.'], 403);
        } catch (CctvException $e) {
            return $this->errorResponse($e);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to start the live stream.'], 500);
        }
    }

    /** GET /cctv/snapshot/{id} — proxies a single JPEG frame; the DVR's IP is never exposed to the client. */
    public function snapshot(Request $request, $id)
    {
        try {
            $camera = $this->cameras->find((int) $id);
            $this->authorize('stream', $camera);

            $bytes = $this->stream->snapshot($camera);

            return response($bytes, 200)->header('Content-Type', 'image/jpeg');
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Camera not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this camera.'], 403);
        } catch (CctvException $e) {
            return $this->errorResponse($e);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to fetch snapshot.'], 500);
        }
    }
}
