<?php

namespace App\Modules\SiteTracking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreMaterialTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'material_id' => ['required', 'integer', 'exists:materials,id'],
            'type' => ['required', 'string', 'in:in,out'],
            'date' => ['required', 'date'],
            // Quantity/unit_price are optional — a lump-sum purchase (e.g.
            // "Sanitary materials — ৳1,550") often has no meaningful unit
            // breakdown; see MaterialTransactionData's docblock.
            'quantity' => ['nullable', 'numeric', 'gt:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'total_cost' => ['nullable', 'numeric', 'min:0'],
            'transportation_cost' => ['nullable', 'numeric', 'min:0'],
            'carrying_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'used_for' => ['nullable', 'string', 'max:255'],
            'receipt' => ['nullable', 'file', 'max:10240'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        // A row needs SOME way to know its cost or quantity — either an
        // explicit amount, or enough (quantity + unit_price) to compute one.
        // Otherwise it's neither a usable purchase record nor a stock movement.
        $validator->after(function (Validator $v) {
            $data = $v->getData();
            $hasAmount = !empty($data['total_cost']);
            $hasQtyAndRate = !empty($data['quantity']) && !empty($data['unit_price']);
            $hasQtyOnly = !empty($data['quantity']);

            if (!$hasAmount && !$hasQtyAndRate && !$hasQtyOnly) {
                $v->errors()->add('quantity', 'Enter a quantity, an amount, or both.');
            }
        });
    }
}
