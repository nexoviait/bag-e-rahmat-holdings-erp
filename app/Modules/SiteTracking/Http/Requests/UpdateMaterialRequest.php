<?php

namespace App\Modules\SiteTracking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaterialRequest extends FormRequest
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
                // Same unique(project_id, name) check as StoreMaterialRequest,
                // ignoring this record's own row so renaming to your own
                // current name (a no-op edit) isn't flagged as a conflict.
                Rule::unique('materials', 'name')
                    ->where(fn ($query) => $query->where('project_id', $this->input('project_id')))
                    ->ignore($this->route('id')),
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
