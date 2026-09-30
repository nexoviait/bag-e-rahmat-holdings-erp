<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Shortlisted wasn't actually a final decision — there was no way to
 * actually approve/hire a shortlisted applicant, only reject. Adds
 * 'approved' as the real positive terminal status.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE job_applications MODIFY COLUMN status ENUM('pending', 'shortlisted', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE job_applications SET status = 'shortlisted' WHERE status = 'approved'");
        DB::statement("ALTER TABLE job_applications MODIFY COLUMN status ENUM('pending', 'shortlisted', 'rejected') NOT NULL DEFAULT 'pending'");
    }
};
