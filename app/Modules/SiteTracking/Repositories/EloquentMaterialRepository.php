<?php

namespace App\Modules\SiteTracking\Repositories;

use App\Models\Material;
use App\Models\MaterialTransaction;
use App\Modules\SiteTracking\Contracts\MaterialRepositoryInterface;
use App\Modules\SiteTracking\DTO\MaterialData;
use Illuminate\Support\Collection;

final class EloquentMaterialRepository implements MaterialRepositoryInterface
{
    public function findOrFail(int $id): Material
    {
        return Material::findOrFail($id);
    }

    public function listWithStock(int $projectId): Collection
    {
        // withSum runs two correlated-subquery SUMs in the same query as the
        // materials list (no N+1), so current_stock is always fresh —
        // there is no stored running-balance column to drift out of sync.
        return Material::where('project_id', $projectId)
            ->where('is_active', true)
            ->withSum(
                ['transactions as in_qty' => fn ($q) => $q->where('type', MaterialTransaction::TYPE_IN)],
                'quantity'
            )
            ->withSum(
                ['transactions as out_qty' => fn ($q) => $q->where('type', MaterialTransaction::TYPE_OUT)],
                'quantity'
            )
            ->orderBy('name')
            ->get()
            ->each(function (Material $m) {
                $m->current_stock = round((float) ($m->in_qty ?? 0) - (float) ($m->out_qty ?? 0), 3);
            });
    }

    public function create(MaterialData $data, ?int $createdBy): Material
    {
        return Material::create([
            ...$data->toModelAttributes(),
            'created_by' => $createdBy,
        ]);
    }

    public function update(Material $material, MaterialData $data): Material
    {
        $material->update($data->toModelAttributes());

        return $material->fresh();
    }

    public function delete(Material $material): void
    {
        $material->delete();
    }
}
