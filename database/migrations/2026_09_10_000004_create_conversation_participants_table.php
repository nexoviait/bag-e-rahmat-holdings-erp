<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // 'admin' only meaningful for groups (can add/remove members, rename,
            // etc.) — always 'member' for both sides of a direct conversation.
            $table->enum('role', ['admin', 'member'])->default('member');
            $table->boolean('muted')->default(false);
            $table->timestamp('joined_at')->nullable();
            // Soft-remove, not delete — leaving a group (or being unassigned from
            // the project, see ProjectAssignment::deleted hook) must not erase
            // "X left the group" history or their read watermark below.
            $table->timestamp('left_at')->nullable();
            // Single watermark serving both unread-counts and group "seen by"
            // lists — not a per-message-per-recipient read table.
            $table->foreignId('last_read_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_participants');
    }
};
