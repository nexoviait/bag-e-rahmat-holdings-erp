<?php

namespace App\Modules\Cctv\Http\Requests;

use App\Models\DvrDevice;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Authorization is handled explicitly in the controller via $this->authorize(),
 * not here — keeps validation and authorization concerns separate and testable
 * independently.
 */
class StoreDvrDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'device_name' => ['required', 'string', 'max:120'],
            'brand' => ['nullable', 'string', 'max:50'],
            'model' => ['nullable', 'string', 'max:80'],
            'ip_address' => ['required', 'string', 'max:255'],
            'http_port' => ['nullable', 'integer', 'between:1,65535'],
            'rtsp_port' => ['nullable', 'integer', 'between:1,65535'],
            'username' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'min:1', 'max:200'],
            'serial_number' => ['nullable', 'string', 'max:64'],
            'channel_count' => ['nullable', 'integer', 'between:1,64'],
            'visibility' => ['nullable', 'string', 'in:' . implode(',', [
                DvrDevice::VISIBILITY_ADMIN_ONLY,
                DvrDevice::VISIBILITY_SPECIFIC,
                DvrDevice::VISIBILITY_ALL,
            ])],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
