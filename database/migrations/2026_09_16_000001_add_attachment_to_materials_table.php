<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A material's own master record (name/unit/reorder level) can now carry one
 * attachment too — a product photo, spec sheet, or datasheet PDF describing
 * the material itself, distinct from a material_transaction's receipt (which
 * documents one specific purchase/usage, not the material generally). Same
 * authenticated-proxy pattern and private disk as every other file field in
 * this app (see 2026_09_10_000008_add_cost_breakdown_and_receipt_to_material_transactions).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->string('attachment_path')->nullable()->after('notes');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime')->nullable()->after('attachment_name');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_mime']);
        });
    }
};
