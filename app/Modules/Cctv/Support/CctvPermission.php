<?php

namespace App\Modules\Cctv\Support;

/**
 * Single source of truth for CCTV permission name strings, so controllers/policies
 * never hand-type 'cctv.devices.edit' and risk a typo silently failing open/closed.
 * Must stay in sync with database/migrations/2026_08_01_000004_add_cctv_permissions.php.
 */
final class CctvPermission
{
    public const VIEW = 'cctv.view';
    public const DEVICES_VIEW = 'cctv.devices.view';
    public const DEVICES_CREATE = 'cctv.devices.create';
    public const DEVICES_EDIT = 'cctv.devices.edit';
    public const DEVICES_DELETE = 'cctv.devices.delete';
    public const DEVICES_TEST = 'cctv.devices.test';
    public const CAMERAS_EDIT = 'cctv.cameras.edit';
    public const SNAPSHOT = 'cctv.snapshot';
    public const LOGS_VIEW = 'cctv.logs.view';
    public const ASSIGN = 'cctv.assign';
    public const PLAYBACK_VIEW = 'cctv.playback.view';
    public const PTZ = 'cctv.ptz';
    public const EVENTS_VIEW = 'cctv.events.view';
}
