<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $defaults = [
            'Contract',
            'Legal Document',
            'Land Deed / Ownership',
            'Financial Statement',
            'Identification (NID/Passport)',
            'Agreement',
            'Certificate',
            'Invoice / Receipt',
            'Report',
            'Other',
        ];

        $now = now();
        DB::table('document_types')->insert(array_map(fn ($name) => [
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ], $defaults));
    }

    public function down(): void
    {
        Schema::dropIfExists('document_types');
    }
};
