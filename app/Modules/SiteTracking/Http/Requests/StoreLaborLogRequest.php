<?php

namespace App\Modules\SiteTracking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreLaborLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'date' => ['required', 'date'],
            'labor_type' => ['required', 'string', 'max:60'],
            'headcount' => ['required', 'integer', 'min:1'],
            'wage_rate' => ['nullable', 'numeric', 'min:0'],
            // Optional override — see LaborLogData::fromArray for the
            // headcount*wage_rate auto-derivation when omitted.
            'total_cost' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
