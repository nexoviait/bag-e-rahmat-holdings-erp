<?php

namespace App\Modules\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:direct,group'],
            'name' => ['required_if:type,group', 'nullable', 'string', 'max:120'],
            'member_user_ids' => ['required', 'array', 'min:1'],
            'member_user_ids.*' => ['integer', 'exists:users,id'],
        ];
    }
}
