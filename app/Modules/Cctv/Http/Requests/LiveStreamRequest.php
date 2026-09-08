<?php

namespace App\Modules\Cctv\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LiveStreamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quality' => ['nullable', 'string', 'in:main,sub'],
        ];
    }
}
