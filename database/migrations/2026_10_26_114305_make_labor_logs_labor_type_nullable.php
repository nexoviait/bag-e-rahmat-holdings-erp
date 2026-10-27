<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Raw SQL — doctrine/dbal isn't installed, so Schema::table(...)->nullable()
// ->change() isn't available here (same reasoning as every other column-type
// migration in this project). Labor Type is being dropped from the add/edit
// form entirely (no longer a required categorization step); new entries
// store null, existing typed entries are left untouched.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE labor_logs MODIFY COLUMN labor_type VARCHAR(60) NULL");
    }

    public function down(): void
    {
        DB::statement("UPDATE labor_logs SET labor_type = 'General Labor' WHERE labor_type IS NULL");
        DB::statement("ALTER TABLE labor_logs MODIFY COLUMN labor_type VARCHAR(60) NOT NULL");
    }
};
