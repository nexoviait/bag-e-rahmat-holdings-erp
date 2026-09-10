<?php

namespace App\Modules\Chat\Support;

/**
 * Single source of truth for this module's permission name strings. Must stay
 * in sync with database/migrations/2026_09_10_000005_add_chat_permissions.php
 * and database/seeders/DatabaseSeeder.php (permission strings are duplicated by
 * design, not generated — see the seeder's sync warning comment).
 */
final class ChatPermission
{
    public const VIEW = 'chat.view';
    public const SEND = 'chat.send';
    public const GROUPS_CREATE = 'chat.groups.create';
    public const CALLS_INITIATE = 'chat.calls.initiate';
}
