<?php

namespace App\Modules\Cctv\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncCameraAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ];
    }
}
