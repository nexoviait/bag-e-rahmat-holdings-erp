<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dvr_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('device_name', 120);
            $table->string('brand', 50)->default('Dahua');
            $table->string('model', 80)->nullable();
            $table->string('ip_address', 45);
            $table->unsignedSmallInteger('http_port')->default(80);
            $table->unsignedSmallInteger('rtsp_port')->default(554);
            $table->string('username', 64);
            // 'text' not 'string' — Laravel's `encrypted` cast produces a ciphertext
            // envelope (~250+ chars) that can overflow varchar(255) for longer passwords.
            $table->text('password');
            $table->string('serial_number', 64)->nullable()->unique();
            $table->unsignedTinyInteger('channel_count')->default(16);
            // admin_only | specific | all — mirrors ProjectDocument.visibility
            $table->string('visibility', 20)->default('all');
            // online | offline | unauthorized | unknown
            $table->string('status', 20)->default('unknown');
            $table->timestamp('last_seen_at')->nullable();
            $table->text('last_error')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Scoped to project, not global — two projects behind separate NATs can
            // legitimately reuse the same private IP address.
            $table->unique(['project_id', 'ip_address', 'http_port'], 'dvr_devices_project_ip_port_unique');
            $table->index(['is_active', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dvr_devices');
    }
};
