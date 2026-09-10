<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            // Nullable + nullOnDelete — a deleted user's messages stay visible,
            // matching camera_logs/project_documents' convention rather than
            // cascading the whole message away.
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['text', 'image', 'video', 'file', 'voice_note', 'system'])->default('text');
            $table->text('body')->nullable();
            // One attachment per message row, matching this app's one-file-
            // per-record convention (Expense/Revenue/OwnerPayment receipts).
            // Populated in Phase B.
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->string('attachment_mime')->nullable();
            $table->unsignedBigInteger('attachment_size')->nullable();
            $table->unsignedInteger('attachment_duration_ms')->nullable();
            // Schema-ready for a later quote-reply round even though the UI
            // isn't built now.
            $table->foreignId('reply_to_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->timestamps();

            // Unread-range scans: "messages in this conversation after my
            // last-read watermark", both ordered by time and by id.
            $table->index(['conversation_id', 'created_at']);
            $table->index(['conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
