<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('camera_channels', function (Blueprint $table) {
            $table->id();
            // Named dvr_device_id (not the requested dvr_id) so belongsTo(DvrDevice::class)
            // resolves by Eloquent convention with no explicit key argument.
            $table->foreignId('dvr_device_id')->constrained('dvr_devices')->cascadeOnDelete();
            $table->unsignedTinyInteger('channel_number');
            $table->string('camera_name', 120);
            $table->string('location', 160)->nullable();
            // Stable MediaMTX path name (e.g. p3-dvr7-ch4). Stored, not derived, so
            // playback URLs survive camera renames.
            $table->string('stream_path', 80)->unique();
            // Override only — NULL means the URL is derived by DahuaUrlBuilder in Phase 2.
            // Never stores credentials.
            $table->string('stream_url', 500)->nullable();
            $table->string('snapshot_url', 500)->nullable();
            // 0 = main stream, 1 = sub stream. The grid requests substreams by default —
            // a 16-channel XVR has a hard cap on concurrent RTSP sessions.
            $table->unsignedTinyInteger('stream_subtype')->default(0);
            $table->string('status', 20)->default('unknown');
            $table->timestamp('last_seen_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['dvr_device_id', 'channel_number'], 'camera_channels_device_channel_unique');
            $table->index(['is_active', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('camera_channels');
    }
};
