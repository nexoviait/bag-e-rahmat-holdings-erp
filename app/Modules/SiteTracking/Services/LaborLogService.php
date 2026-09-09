<?php

namespace App\Modules\SiteTracking\Services;

use App\Models\ActivityLog;
use App\Models\LaborLog;
use App\Models\User;
use App\Modules\SiteTracking\Contracts\LaborLogRepositoryInterface;
use App\Modules\SiteTracking\DTO\LaborLogData;
use Illuminate\Database\Eloquent\Collection;

final class LaborLogService
{
    public function __construct(
        private readonly LaborLogRepositoryInterface $laborLogs,
    ) {}

    public function listForProject(int $projectId, ?string $date = null): Collection
    {
        return $this->laborLogs->listForProject($projectId, $date);
    }

    public function find(int $id): LaborLog
    {
        return $this->laborLogs->findOrFail($id);
    }

    public function create(LaborLogData $data, User $actor): LaborLog
    {
        $log = $this->laborLogs->create($data, $actor->id);

        ActivityLog::create([
            'project_id' => $log->project_id,
            'user_id' => $actor->id,
            'action' => "Logged {$log->headcount} {$log->labor_type} for " . $log->date->format('Y-m-d'),
            'entity' => 'LaborLog',
            'entity_id' => (string) $log->id,
        ]);

        return $log;
    }

    public function update(LaborLog $log, LaborLogData $data, User $actor): LaborLog
    {
        $log = $this->laborLogs->update($log, $data);

        ActivityLog::create([
            'project_id' => $log->project_id,
            'user_id' => $actor->id,
            'action' => "Updated a labor log entry (\"{$log->labor_type}\")",
            'entity' => 'LaborLog',
            'entity_id' => (string) $log->id,
        ]);

        return $log;
    }

    public function delete(LaborLog $log, User $actor): void
    {
        $projectId = $log->project_id;
        $id = $log->id;
        $laborType = $log->labor_type;

        $this->laborLogs->delete($log);

        ActivityLog::create([
            'project_id' => $projectId,
            'user_id' => $actor->id,
            'action' => "Deleted a labor log entry (\"{$laborType}\")",
            'entity' => 'LaborLog',
            'entity_id' => (string) $id,
        ]);
    }

    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float
    {
        return $this->laborLogs->sumCostForProject($projectId, $from, $to);
    }
}
