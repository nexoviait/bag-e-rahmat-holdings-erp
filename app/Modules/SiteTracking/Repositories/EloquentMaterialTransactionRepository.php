<?php

namespace App\Modules\SiteTracking\Repositories;

use App\Models\MaterialTransaction;
use App\Modules\SiteTracking\Contracts\MaterialTransactionRepositoryInterface;
use App\Modules\SiteTracking\DTO\MaterialTransactionData;
use Illuminate\Database\Eloquent\Collection;

final class EloquentMaterialTransactionRepository implements MaterialTransactionRepositoryInterface
{
    public function findOrFail(int $id): MaterialTransaction
    {
        return MaterialTransaction::with('material')->findOrFail($id);
    }

    public function listForProject(int $projectId, ?string $date = null): Collection
    {
        $query = MaterialTransaction::with('material')->where('project_id', $projectId);

        if ($date) {
            $query->whereDate('date', $date);
        }

        return $query->orderByDesc('date')->orderByDesc('id')->get();
    }

    public function create(MaterialTransactionData $data, ?int $createdBy): MaterialTransaction
    {
        return MaterialTransaction::create([
            ...$data->toModelAttributes(),
            'created_by' => $createdBy,
        ]);
    }

    public function update(MaterialTransaction $transaction, MaterialTransactionData $data): MaterialTransaction
    {
        $transaction->update($data->toModelAttributes());

        return $transaction->fresh(['material']);
    }

    public function delete(MaterialTransaction $transaction): void
    {
        $transaction->delete();
    }

    public function sumCostForProject(int $projectId, ?string $from = null, ?string $to = null): float
    {
        $query = MaterialTransaction::where('project_id', $projectId)
            ->where('type', MaterialTransaction::TYPE_IN);

        if ($from) {
            $query->whereDate('date', '>=', $from);
        }
        if ($to) {
            $query->whereDate('date', '<=', $to);
        }

        return (float) $query->sum('total_cost');
    }
}
