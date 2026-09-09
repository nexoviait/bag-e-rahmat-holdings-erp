<?php

namespace App\Modules\SiteTracking\Services;

use App\Models\ActivityLog;
use App\Models\MaterialTransaction;
use App\Models\User;
use App\Modules\SiteTracking\Contracts\MaterialTransactionRepositoryInterface;
use App\Modules\SiteTracking\DTO\MaterialTransactionData;
use Illuminate\Database\Eloquent\Collection;

final class MaterialTransactionService
{
    public function __construct(
        private readonly MaterialTransactionRepositoryInterface $transactions,
    ) {}

    public function listForProject(int $projectId, ?string $date = null): Collection
    {
        return $this->transactions->listForProject($projectId, $date);
    }

    public function find(int $id): MaterialTransaction
    {
        return $this->transactions->findOrFail($id);
    }

    public function create(MaterialTransactionData $data, User $actor): MaterialTransaction
    {
        $transaction = $this->transactions->create($data, $actor->id);
        $transaction->load('material');

        $verb = $transaction->type === MaterialTransaction::TYPE_IN ? 'Received' : 'Used';
        ActivityLog::create([
            'project_id' => $transaction->project_id,
            'user_id' => $actor->id,
            'action' => "{$verb} {$transaction->quantity} {$transaction->material->unit} of \"{$transaction->material->name}\"",
            'entity' => 'MaterialTransaction',
            'entity_id' => (string) $transaction->id,
        ]);

        return $transaction;
    }

    public function update(MaterialTransaction $transaction, MaterialTransactionData $data, User $actor): MaterialTransaction
    {
        $transaction = $this->transactions->update($transaction, $data);

        ActivityLog::create([
            'project_id' => $transaction->project_id,
            'user_id' => $actor->id,
            'action' => "Updated a material transaction for \"{$transaction->material->name}\"",
            'entity' => 'MaterialTransaction',
            'entity_id' => (string) $transaction->id,
        ]);

        return $transaction;
    }

    public function delete(MaterialTransaction $transaction, User $actor): void
    {
        $projectId = $transaction->project_id;
        $id = $transaction->id;
        $materialName = $transaction->material->name;

        $this->transactions->delete($transaction);

        ActivityLog::create([
            'project_id' => $projectId,
            'user_id' => $actor->id,
            'action' => "Deleted a material transaction for \"{$materialName}\"",
            'entity' => 'MaterialTransaction',
            'entity_id' => (string) $id,
        ]);
    }

    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float
    {
        return $this->transactions->sumCostForProject($projectId, $from, $to);
    }
}
