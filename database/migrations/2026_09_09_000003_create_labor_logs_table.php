<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labor_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->date('date');
            $table->string('labor_type', 60); // e.g. Mason, Helper, Electrician — free text
            $table->unsignedInteger('headcount');
            $table->decimal('wage_rate', 15, 2)->nullable(); // per-person daily rate
            // headcount*wage_rate, but stored (not derived) since it's editable —
            // a supervisor may need to override the auto-computed total.
            $table->decimal('total_cost', 15, 2);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('labor_logs');
    }
};
