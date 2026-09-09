<?php

namespace App\Modules\SiteTracking\Services;

use App\Models\ActivityLog;
use App\Models\Material;
use App\Models\User;
use App\Modules\SiteTracking\Contracts\MaterialRepositoryInterface;
use App\Modules\SiteTracking\DTO\MaterialData;
use Illuminate\Support\Collection;

final class MaterialService
{
    public function __construct(
        private readonly MaterialRepositoryInterface $materials,
    ) {}

    public function listWithStock(int $projectId): Collection
    {
        return $this->materials->listWithStock($projectId);
    }

    public function find(int $id): Material
    {
        return $this->materials->findOrFail($id);
    }

    public function create(MaterialData $data, User $actor): Material
    {
        $material = $this->materials->create($data, $actor->id);

        ActivityLog::create([
            'project_id' => $material->project_id,
            'user_id' => $actor->id,
            'action' => "Added material \"{$material->name}\"",
            'entity' => 'Material',
            'entity_id' => (string) $material->id,
        ]);

        return $material;
    }

    public function update(Material $material, MaterialData $data, User $actor): Material
    {
        $material = $this->materials->update($material, $data);

        ActivityLog::create([
            'project_id' => $material->project_id,
            'user_id' => $actor->id,
            'action' => "Updated material \"{$material->name}\"",
            'entity' => 'Material',
            'entity_id' => (string) $material->id,
        ]);

        return $material;
    }

    public function delete(Material $material, User $actor): void
    {
        $name = $material->name;
        $projectId = $material->project_id;
        $id = $material->id;

        $this->materials->delete($material);

        ActivityLog::create([
            'project_id' => $projectId,
            'user_id' => $actor->id,
            'action' => "Deleted material \"{$name}\"",
            'entity' => 'Material',
            'entity_id' => (string) $id,
        ]);
    }
}
