<?php

namespace App\Modules\SiteTracking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'name' => [
                'required',
                'string',
                'max:120',
                // The `materials` table has a unique(project_id, name) index —
                // checking it here turns a duplicate name into a normal 422
                // instead of an unhandled QueryException surfacing as a raw
                // "Failed to create material." 500 (the actual bug this fixes:
                // a "new item" purchase whose transaction step then failed
                // would retry-create the same-named material on the next
                // Save click and hit this constraint).
                Rule::unique('materials', 'name')->where(
                    fn ($query) => $query->where('project_id', $this->input('project_id'))
                ),
            ],
            'unit' => ['required', 'string', 'max:20'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'max:10240'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'A material named ":input" already exists in this project.',
        ];
    }
}
