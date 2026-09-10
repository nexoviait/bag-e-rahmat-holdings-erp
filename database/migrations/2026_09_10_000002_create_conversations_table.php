<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->enum('type', ['direct', 'group']);
            // Groups only — nullable for direct conversations.
            $table->string('name', 120)->nullable();
            $table->string('avatar_path')->nullable();
            // "{projectId}:{minUserId}:{maxUserId}" for direct conversations only
            // (null for groups). Makes 1:1 dedup an atomic unique-constraint
            // lookup — "does this pair already have a DM in this project?" —
            // instead of a check-then-create race between two app requests.
            $table->string('direct_key', 60)->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
