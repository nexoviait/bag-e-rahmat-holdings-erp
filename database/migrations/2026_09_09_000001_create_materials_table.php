<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('name', 120);
            // Free-text like Expense's 'category' column — enforced as a small
            // fixed-list-plus-custom dropdown in the frontend, not a DB enum.
            $table->string('unit', 20);
            // Low-stock threshold. Nullable — most materials won't set one.
            $table->decimal('reorder_level', 12, 3)->nullable();
            $table->text('notes')->nullable();
            // Soft-hide instead of hard delete once a material has transaction
            // history — mirrors DvrDevice's is_active convention.
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
