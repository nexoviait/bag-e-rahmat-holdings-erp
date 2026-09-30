<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Sell / Development-for-BAG requests against a user's own property —
    // same request/approve shape as ShareOwnershipRequest/NocRequest, but
    // approving here only flips the parent Property's status (see
    // PropertyRequestController::updateStatus()); it doesn't move any
    // ownership records the way Share Transfer/Sell does.
    public function up(): void
    {
        Schema::create('property_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained('properties')->cascadeOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->enum('kind', ['sell', 'development']);
            $table->decimal('asking_price', 15, 2)->nullable();
            $table->text('details')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_requests');
    }
};
