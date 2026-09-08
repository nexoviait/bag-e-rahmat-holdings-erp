<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('camera_logs', function (Blueprint $table) {
            $table->id();
            // Nullable: device-level events (e.g. a failed sync) have no camera.
            $table->foreignId('camera_channel_id')->nullable()->constrained('camera_channels')->cascadeOnDelete();
            $table->foreignId('dvr_device_id')->nullable()->constrained('dvr_devices')->cascadeOnDelete();
            $table->string('event', 64);
            $table->text('description')->nullable();
            $table->json('meta')->nullable();
            // Nullable: system-generated events (status polls) have no acting user.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['camera_channel_id', 'created_at']);
            $table->index(['dvr_device_id', 'created_at']);
            $table->index('event');
        });

        // Per-camera visibility override, consulted only when the owning device's
        // visibility mode is 'specific'. Mirrors project_document_assignees — no
        // dedicated Eloquent model, accessed purely as a belongsToMany pivot.
        Schema::create('camera_user_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camera_channel_id')->constrained('camera_channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['camera_channel_id', 'user_id'], 'camera_user_assignments_unique');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('camera_user_assignments');
        Schema::dropIfExists('camera_logs');
    }
};
