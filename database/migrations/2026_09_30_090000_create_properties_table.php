<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Not project-scoped — a user's personal property isn't tied to any
    // project, same reasoning as job_applications.
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->enum('type', ['land', 'flat', 'building', 'other'])->default('other');
            $table->string('location');
            $table->text('description')->nullable();
            $table->decimal('estimated_value', 15, 2)->nullable();
            // 'for_sale'/'offered_for_development' are set automatically when
            // a PropertyRequest of that kind gets Super Admin approval — see
            // PropertyRequestController::updateStatus().
            $table->enum('status', ['owned', 'for_sale', 'offered_for_development'])->default('owned');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
