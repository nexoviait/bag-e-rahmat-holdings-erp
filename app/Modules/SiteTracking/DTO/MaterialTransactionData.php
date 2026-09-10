<?php

namespace App\Modules\SiteTracking\DTO;

use App\Models\MaterialTransaction;

final readonly class MaterialTransactionData
{
    public function __construct(
        public int $projectId,
        public int $materialId,
        public string $type,
        public string $date,
        public ?float $quantity,
        public ?float $unitPrice,
        public ?float $totalCost,
        public ?float $transportationCost,
        public ?float $carryingCost,
        public ?string $supplier,
        public ?string $usedFor,
        public ?string $receiptPath = null,
        public ?string $receiptName = null,
        public ?string $receiptMime = null,
    ) {}

    /**
     * Real site purchase logs (per the user's own tracking sheet) don't always
     * have a meaningful quantity/rate — a lump-sum item like "Sanitary
     * materials — ৳1,550" or "1 HP jet water pump — ৳5,400" has no unit
     * breakdown, and even when quantity IS known, the recorded amount doesn't
     * always equal quantity×rate exactly (rounding, negotiated lump prices).
     * So total_cost is authoritative when the client supplies it directly;
     * quantity×unit_price is only a fallback for the common case where both
     * are given and the amount wasn't typed separately.
     */
    public static function fromArray(array $data): self
    {
        $type = $data['type'] === MaterialTransaction::TYPE_OUT
            ? MaterialTransaction::TYPE_OUT
            : MaterialTransaction::TYPE_IN;

        $quantity = isset($data['quantity']) && $data['quantity'] !== '' ? (float) $data['quantity'] : null;
        $unitPrice = isset($data['unit_price']) && $data['unit_price'] !== '' ? (float) $data['unit_price'] : null;

        $totalCost = match (true) {
            isset($data['total_cost']) && $data['total_cost'] !== '' => round((float) $data['total_cost'], 2),
            $type === MaterialTransaction::TYPE_IN && $quantity !== null && $unitPrice !== null => round($quantity * $unitPrice, 2),
            default => null,
        };

        // Transport/carrying are their own real costs on a purchase — kept as
        // separate columns rather than folded into total_cost so reports can
        // break "materials vs. transport vs. carrying" apart. Not meaningful
        // for a plain usage (OUT) row, same reasoning as supplier below.
        $transportationCost = $type === MaterialTransaction::TYPE_IN && isset($data['transportation_cost']) && $data['transportation_cost'] !== ''
            ? round((float) $data['transportation_cost'], 2)
            : null;
        $carryingCost = $type === MaterialTransaction::TYPE_IN && isset($data['carrying_cost']) && $data['carrying_cost'] !== ''
            ? round((float) $data['carrying_cost'], 2)
            : null;

        return new self(
            projectId: (int) $data['project_id'],
            materialId: (int) $data['material_id'],
            type: $type,
            date: $data['date'],
            quantity: $quantity,
            unitPrice: $type === MaterialTransaction::TYPE_IN ? $unitPrice : null,
            totalCost: $totalCost,
            transportationCost: $transportationCost,
            carryingCost: $carryingCost,
            supplier: $type === MaterialTransaction::TYPE_IN ? ($data['supplier'] ?? null) : null,
            // Unlike supplier, the work-item tag applies to a purchase as much
            // as to a usage — the user's sheet tags every purchase row with
            // the work item it's for (e.g. "Mat CC"), not only consumption.
            usedFor: $data['used_for'] ?? null,
        );
    }

    /** Applied after fromArray() once an uploaded receipt file has actually been stored — see handleReceiptUpload(). */
    public function withReceipt(array $attrs): self
    {
        return new self(
            projectId: $this->projectId,
            materialId: $this->materialId,
            type: $this->type,
            date: $this->date,
            quantity: $this->quantity,
            unitPrice: $this->unitPrice,
            totalCost: $this->totalCost,
            transportationCost: $this->transportationCost,
            carryingCost: $this->carryingCost,
            supplier: $this->supplier,
            usedFor: $this->usedFor,
            receiptPath: $attrs['receipt_path'],
            receiptName: $attrs['receipt_name'],
            receiptMime: $attrs['receipt_mime'],
        );
    }

    public function toModelAttributes(): array
    {
        $attributes = [
            'project_id' => $this->projectId,
            'material_id' => $this->materialId,
            'type' => $this->type,
            'date' => $this->date,
            'quantity' => $this->quantity,
            'unit_price' => $this->unitPrice,
            'total_cost' => $this->totalCost,
            'transportation_cost' => $this->transportationCost,
            'carrying_cost' => $this->carryingCost,
            'supplier' => $this->supplier,
            'used_for' => $this->usedFor,
        ];

        // Only present (and only overwritten) when a new receipt was actually
        // uploaded this request — see MaterialTransactionController::update(),
        // which otherwise leaves an existing receipt untouched.
        if ($this->receiptPath !== null) {
            $attributes['receipt_path'] = $this->receiptPath;
            $attributes['receipt_name'] = $this->receiptName;
            $attributes['receipt_mime'] = $this->receiptMime;
        }

        return $attributes;
    }
}
