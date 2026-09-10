<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->enum('type', ['audio', 'video']);
            $table->enum('status', ['ringing', 'ongoing', 'ended', 'missed', 'declined'])->default('ringing');
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            // 'declined' | 'missed' | 'hangup' | 'left_alone' (everyone else left) — a
            // short free-text reason code, not an enum, since this is display-only.
            $table->string('end_reason', 30)->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calls');
    }
};
