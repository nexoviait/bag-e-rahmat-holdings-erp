<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CameraChannel extends Model
{
    use HasFactory;

    public const STATUS_ONLINE = 'online';
    public const STATUS_OFFLINE = 'offline';
    public const STATUS_UNKNOWN = 'unknown';

    public const QUALITY_MAIN = 0;
    public const QUALITY_SUB = 1;

    protected $fillable = [
        'dvr_device_id',
        'channel_number',
        'camera_name',
        'location',
        'stream_path',
        'stream_url',
        'snapshot_url',
        'stream_subtype',
        'status',
        'last_seen_at',
        'is_active',
    ];

    protected $casts = [
        'channel_number' => 'integer',
        'stream_subtype' => 'integer',
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function device()
    {
        return $this->belongsTo(DvrDevice::class, 'dvr_device_id');
    }

    public function logs()
    {
        return $this->hasMany(CameraLog::class);
    }

    /**
     * Per-camera visibility override. Only consulted when the owning device's
     * visibility is 'specific' — otherwise device-level 'all'/'admin_only' decides.
     */
    public function viewers()
    {
        return $this->belongsToMany(User::class, 'camera_user_assignments')->withTimestamps();
    }
}
