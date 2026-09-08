<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CameraLog extends Model
{
    protected $fillable = [
        'camera_channel_id',
        'dvr_device_id',
        'event',
        'description',
        'meta',
        'created_by',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function camera()
    {
        return $this->belongsTo(CameraChannel::class, 'camera_channel_id');
    }

    public function device()
    {
        return $this->belongsTo(DvrDevice::class, 'dvr_device_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
