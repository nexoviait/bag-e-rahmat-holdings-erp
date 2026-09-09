<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_transactions', function (Blueprint $table) {
            $table->id();
            // Denormalized alongside material_id — every project-scoped query
            // (daily summary, report rollups) filters by project_id directly
            // without needing to join through materials first.
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->string('type', 10); // 'in' (purchase/received) | 'out' (used/consumed)
            $table->date('date');
            $table->decimal('quantity', 12, 3);
            // Only meaningful for 'in' — what was paid per unit.
            $table->decimal('unit_price', 15, 2)->nullable();
            // Server-computed as quantity*unit_price for 'in'; null for 'out'.
            // Never trust a client-supplied total — see MaterialTransactionService.
            $table->decimal('total_cost', 15, 2)->nullable();
            $table->string('supplier', 150)->nullable();
            $table->text('used_for')->nullable(); // purpose/location, relevant for 'out'
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'date']);
            $table->index('material_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_transactions');
    }
};
