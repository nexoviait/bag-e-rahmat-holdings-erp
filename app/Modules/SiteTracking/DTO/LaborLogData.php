<?php

namespace App\Modules\SiteTracking\DTO;

final readonly class LaborLogData
{
    public function __construct(
        public int $projectId,
        public string $date,
        public string $laborType,
        public int $headcount,
        public ?float $wageRate,
        public float $totalCost,
        public ?string $notes,
    ) {}

    public static function fromArray(array $data): self
    {
        $headcount = (int) $data['headcount'];
        $wageRate = isset($data['wage_rate']) && $data['wage_rate'] !== '' ? (float) $data['wage_rate'] : null;

        // If the caller supplies an explicit total_cost, that's an intentional
        // override (e.g. a bonus/deduction baked in) — respect it. Otherwise
        // derive it from headcount*wage_rate so a plain quick-add never has to
        // do the multiplication itself.
        $totalCost = isset($data['total_cost']) && $data['total_cost'] !== ''
            ? (float) $data['total_cost']
            : round($headcount * ($wageRate ?? 0), 2);

        return new self(
            projectId: (int) $data['project_id'],
            date: $data['date'],
            laborType: $data['labor_type'],
            headcount: $headcount,
            wageRate: $wageRate,
            totalCost: $totalCost,
            notes: $data['notes'] ?? null,
        );
    }

    public function toModelAttributes(): array
    {
        return [
            'project_id' => $this->projectId,
            'date' => $this->date,
            'labor_type' => $this->laborType,
            'headcount' => $this->headcount,
            'wage_rate' => $this->wageRate,
            'total_cost' => $this->totalCost,
            'notes' => $this->notes,
        ];
    }
}
