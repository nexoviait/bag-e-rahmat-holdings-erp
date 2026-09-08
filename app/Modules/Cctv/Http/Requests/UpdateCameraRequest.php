<?php

namespace App\Modules\Cctv\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCameraRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'camera_name' => ['required', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:160'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
