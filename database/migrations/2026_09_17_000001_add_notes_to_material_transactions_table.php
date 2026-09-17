<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A free-text comment on the purchase/usage row itself — distinct from
 * `used_for` (a short work-item/location tag like "Mat CC") and from the
 * material's own master-record `notes` column. Lets someone record something
 * like "paid partial, rest due next week" or "damaged on delivery, replaced"
 * against one specific transaction.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_transactions', function (Blueprint $table) {
            $table->text('notes')->nullable()->after('used_for');
        });
    }

    public function down(): void
    {
        Schema::table('material_transactions', function (Blueprint $table) {
            $table->dropColumn('notes');
        });
    }
};
