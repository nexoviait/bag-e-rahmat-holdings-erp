<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nominees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shareholder_id')->constrained('shareholders')->cascadeOnDelete();
            // The nominee's own login account — created immediately on submission
            // but left `is_active = false` (see AuthController::login) until an
            // admin approves. Cascade: deleting the nominee's account also
            // removes this row rather than leaving it dangling.
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('ownership_percentage', 5, 2);
            $table->string('nid_path');
            $table->string('nid_name');
            $table->string('nid_mime')->nullable();
            $table->string('photo_path');
            $table->string('photo_name');
            $table->string('photo_mime')->nullable();
            $table->enum('status', ['pending', 'approved'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nominees');
    }
};
