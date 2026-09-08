<?php

namespace App\Modules\Cctv\Http\Controllers;

use App\Modules\Cctv\Http\Resources\CctvStatusResource;
use App\Modules\Cctv\Services\CctvStatusService;
use App\Modules\Cctv\Services\DvrDeviceService;
use Illuminate\Http\Request;
use Throwable;

class StatusController extends CctvController
{
    public function __construct(
        private readonly CctvStatusService $status,
        private readonly DvrDeviceService $devices,
    ) {}

    public function __invoke(Request $request)
    {
        try {
            $status = $this->status->statusFor($request->user());

            return response()->json(new CctvStatusResource($status));
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to calculate CCTV status.'], 500);
        }
    }

    /** Projects that have at least one CCTV device visible to the current user — for a project picker. */
    public function projects(Request $request)
    {
        try {
            $devices = $this->devices->listVisibleTo($request->user());

            $projects = $devices->pluck('project')->filter()->unique('id')->values()
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'code' => $p->code]);

            return response()->json($projects);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load projects list.'], 500);
        }
    }
}
