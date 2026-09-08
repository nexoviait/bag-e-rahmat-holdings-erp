<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_document_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_document_id')->constrained('project_documents')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['project_document_id', 'user_id']);
            $table->timestamps();
        });

        Schema::table('project_documents', function (Blueprint $table) {
            $table->string('visibility')->default('admin_only')->after('assigned_to');
        });

        // Migrate existing single assigned_to values into the new pivot table.
        $now = now();
        DB::table('project_documents')->whereNotNull('assigned_to')->get(['id', 'assigned_to'])->each(function ($doc) use ($now) {
            DB::table('project_document_assignees')->insert([
                'project_document_id' => $doc->id,
                'user_id' => $doc->assigned_to,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('project_documents')->where('id', $doc->id)->update(['visibility' => 'specific']);
        });

        Schema::table('project_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
        });
    }

    public function down(): void
    {
        Schema::table('project_documents', function (Blueprint $table) {
            $table->foreignId('assigned_to')->nullable()->after('uploaded_by')->constrained('users')->nullOnDelete();
        });

        DB::table('project_document_assignees')
            ->select('project_document_id', DB::raw('MIN(user_id) as user_id'))
            ->groupBy('project_document_id')
            ->get()
            ->each(function ($row) {
                DB::table('project_documents')->where('id', $row->project_document_id)->update(['assigned_to' => $row->user_id]);
            });

        Schema::table('project_documents', function (Blueprint $table) {
            $table->dropColumn('visibility');
        });

        Schema::dropIfExists('project_document_assignees');
    }
};
