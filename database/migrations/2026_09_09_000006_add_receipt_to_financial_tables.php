<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds an optional receipt/proof-of-payment attachment (jpg/jpeg/png/pdf) to
 * every financial record type — an expense's purchase receipt, a revenue's
 * payment proof, an owner payment's transfer screenshot, a budget's quote.
 * Added to all four tables uniformly so FinancialController's generic
 * getModel()-based handling doesn't need type-specific branching.
 */
return new class extends Migration
{
    private const TABLES = ['budgets', 'revenues', 'expenses', 'owner_payments'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->string('receipt_path')->nullable();
                $t->string('receipt_name')->nullable();
                $t->string('receipt_mime', 100)->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn(['receipt_path', 'receipt_name', 'receipt_mime']);
            });
        }
    }
};
