<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the 3 document types the new RAJUK tab uses as its fixed upload
 * categories (RajukTab.tsx). These are plain rows in the existing
 * document_types table — RAJUK documents are still stored as regular
 * project_documents rows, just pre-tagged with one of these type names, so
 * the tab reuses ProjectDocumentController's upload/download/delete
 * endpoints and permissions as-is rather than duplicating that
 * infrastructure. Also usable from the general Documents tab's own type
 * dropdown, in case a RAJUK file ever gets uploaded from there instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        $names = ['RAJUK Approval', 'RAJUK Drawing', 'RAJUK Photo'];
        $now = now();

        foreach ($names as $name) {
            DB::table('document_types')->insertOrIgnore([
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('document_types')->whereIn('name', ['RAJUK Approval', 'RAJUK Drawing', 'RAJUK Photo'])->delete();
    }
};
