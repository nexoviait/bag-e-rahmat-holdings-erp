<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('share_ownership_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shareholder_id')->constrained('shareholders')->cascadeOnDelete();
            // 'transfer' (gift/inheritance, no money) vs 'sell' (has a sale_price) —
            // same underlying ownership-move mechanics, just a different framing
            // and an optional price field.
            $table->enum('kind', ['transfer', 'sell']);
            // The recipient/buyer — an existing system user if known, otherwise
            // just their name/contact so the paperwork can still be filed and a
            // brand-new Shareholder row created for them on approval.
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('to_name');
            $table->string('to_email')->nullable();
            $table->string('to_phone')->nullable();
            $table->decimal('percentage', 5, 2)->nullable();
            $table->unsignedInteger('share_count')->nullable();
            $table->decimal('sale_price', 14, 2)->nullable();
            $table->text('reason')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('share_ownership_requests');
    }
};
