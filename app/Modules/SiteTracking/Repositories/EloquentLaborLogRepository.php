<?php

namespace App\Modules\SiteTracking\Repositories;

use App\Models\LaborLog;
use App\Modules\SiteTracking\Contracts\LaborLogRepositoryInterface;
use App\Modules\SiteTracking\DTO\LaborLogData;
use Illuminate\Database\Eloquent\Collection;

final class EloquentLaborLogRepository implements LaborLogRepositoryInterface
{
    public function findOrFail(int $id): LaborLog
    {
        return LaborLog::findOrFail($id);
    }

    public function listForProject(int $projectId, ?string $date = null): Collection
    {
        $query = LaborLog::where('project_id', $projectId);

        if ($date) {
            $query->whereDate('date', $date);
        }

        return $query->orderByDesc('date')->orderByDesc('id')->get();
    }

    public function create(LaborLogData $data, ?int $createdBy): LaborLog
    {
        return LaborLog::create([
            ...$data->toModelAttributes(),
            'created_by' => $createdBy,
        ]);
    }

    public function update(LaborLog $log, LaborLogData $data): LaborLog
    {
        $log->update($data->toModelAttributes());

        return $log->fresh();
    }

    public function delete(LaborLog $log): void
    {
        $log->delete();
    }

    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float
    {
        $query = LaborLog::where('project_id', $projectId);

        if ($from) {
            $query->whereDate('date', '>=', $from);
        }
        if ($to) {
            $query->whereDate('date', '<=', $to);
        }

        return (float) $query->sum('total_cost');
    }
}
