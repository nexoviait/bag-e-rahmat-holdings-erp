<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Not project-scoped — applying for a job at the company isn't tied to
    // any one project, unlike Share Transfer/Sell/NOC.
    public function up(): void
    {
        Schema::create('job_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('applicant_id')->constrained('users')->cascadeOnDelete();
            $table->string('position');
            $table->text('cover_note')->nullable();
            $table->string('cv_path');
            $table->string('cv_name');
            $table->string('photo_path');
            $table->string('photo_name');
            $table->string('certificate_path')->nullable();
            $table->string('certificate_name')->nullable();
            $table->enum('status', ['pending', 'shortlisted', 'rejected'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_applications');
    }
};
