<?php

namespace App\Modules\SiteTracking\Contracts;

use App\Models\LaborLog;
use App\Modules\SiteTracking\DTO\LaborLogData;
use Illuminate\Database\Eloquent\Collection;

interface LaborLogRepositoryInterface
{
    public function findOrFail(int $id): LaborLog;

    /**
     * $date alone = exact-day match (unchanged). $date + $dateTo = an
     * inclusive range — see MaterialTransactionRepositoryInterface's same
     * method for why.
     *
     * @return Collection<int, LaborLog>
     */
    public function listForProject(int $projectId, ?string $date = null, ?string $dateTo = null): Collection;

    public function create(LaborLogData $data, ?int $createdBy): LaborLog;

    public function update(LaborLog $log, LaborLogData $data): LaborLog;

    public function delete(LaborLog $log): void;

    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float;
}
