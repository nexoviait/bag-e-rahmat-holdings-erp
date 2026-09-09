<?php

namespace App\Modules\SiteTracking\Contracts;

use App\Models\Material;
use App\Modules\SiteTracking\DTO\MaterialData;
use Illuminate\Support\Collection;

interface MaterialRepositoryInterface
{
    public function findOrFail(int $id): Material;

    /**
     * Every active material for the project with its current stock computed
     * in the same query (SUM(in.quantity) - SUM(out.quantity)) — never stored,
     * always derived, so it can never drift out of sync with the transaction
     * history.
     *
     * @return Collection<int, Material> each with a ->current_stock attribute appended
     */
    public function listWithStock(int $projectId): Collection;

    public function create(MaterialData $data, ?int $createdBy): Material;

    public function update(Material $material, MaterialData $data): Material;

    public function delete(Material $material): void;
}
