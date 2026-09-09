<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adjusts material_transactions to match how purchases are actually logged on
 * site (per the user's real tracking sheet): quantity/unit are often blank for
 * a lump-sum purchase (e.g. "Sanitary materials — ৳1,550", "1 HP jet water
 * pump — ৳5,400") where Amount is the number that matters, not a qty×rate
 * computation. Also: the work-item tag ("Mat CC" in their sheet) is applied to
 * every purchase, not only to consumption — used_for is no longer type-gated
 * in the DTO because of this (see MaterialTransactionData).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_transactions', function (Blueprint $table) {
            $table->decimal('quantity', 12, 3)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Backfill any NULLs before re-tightening the column, so the rollback
        // itself doesn't fail on rows created while it was nullable.
        \Illuminate\Support\Facades\DB::table('material_transactions')->whereNull('quantity')->update(['quantity' => 0]);

        Schema::table('material_transactions', function (Blueprint $table) {
            $table->decimal('quantity', 12, 3)->nullable(false)->change();
        });
    }
};
