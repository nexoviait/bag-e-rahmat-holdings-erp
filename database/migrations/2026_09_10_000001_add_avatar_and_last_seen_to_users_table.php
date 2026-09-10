<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('phone');
            // Server-set only (a throttled auth:sanctum middleware tap, once
            // per ~60s per user) — never client-writable, so it's deliberately
            // absent from User::$fillable.
            $table->timestamp('last_seen_at')->nullable()->after('avatar_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['avatar_path', 'last_seen_at']);
        });
    }
};
