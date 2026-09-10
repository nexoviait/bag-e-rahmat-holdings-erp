<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real purchases on site often carry costs beyond the material's own price —
 * a delivery/vehicle charge and separate labor to carry it in from the road —
 * which the user's own tracking sheet records as their own line items rather
 * than folding into the material amount. Tracked as their own nullable
 * columns (not added into total_cost) so reporting can show "materials vs.
 * transport vs. carrying" as distinct breakdowns rather than one blended
 * number. Receipt columns mirror every other financial record in this app
 * (Expense/Revenue/OwnerPayment/Budget) — same authenticated-proxy pattern,
 * same private disk.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_transactions', function (Blueprint $table) {
            $table->decimal('transportation_cost', 15, 2)->nullable()->after('total_cost');
            $table->decimal('carrying_cost', 15, 2)->nullable()->after('transportation_cost');
            $table->string('receipt_path')->nullable()->after('used_for');
            $table->string('receipt_name')->nullable()->after('receipt_path');
            $table->string('receipt_mime')->nullable()->after('receipt_name');
        });
    }

    public function down(): void
    {
        Schema::table('material_transactions', function (Blueprint $table) {
            $table->dropColumn(['transportation_cost', 'carrying_cost', 'receipt_path', 'receipt_name', 'receipt_mime']);
        });
    }
};
