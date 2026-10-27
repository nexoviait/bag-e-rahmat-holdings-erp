<?php

namespace App\Modules\SiteTracking\Contracts;

use App\Models\MaterialTransaction;
use App\Modules\SiteTracking\DTO\MaterialTransactionData;
use Illuminate\Database\Eloquent\Collection;

interface MaterialTransactionRepositoryInterface
{
    public function findOrFail(int $id): MaterialTransaction;

    /**
     * $date alone = exact-day match (unchanged). $date + $dateTo = an
     * inclusive range — lets the Daily Log tab switch between its Daily,
     * Weekly, Monthly and Custom views without a second method.
     *
     * @return Collection<int, MaterialTransaction>
     */
    public function listForProject(int $projectId, ?string $date = null, ?string $dateTo = null): Collection;

    public function create(MaterialTransactionData $data, ?int $createdBy): MaterialTransaction;

    public function update(MaterialTransaction $transaction, MaterialTransactionData $data): MaterialTransaction;

    public function delete(MaterialTransaction $transaction): void;

    /** Sum of 'in' transactions' total_cost for a project, optionally within [from, to]. */
    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float;
}
