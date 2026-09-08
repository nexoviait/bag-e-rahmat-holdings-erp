<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DvrDevice extends Model
{
    use HasFactory;

    public const VISIBILITY_ADMIN_ONLY = 'admin_only';
    public const VISIBILITY_SPECIFIC = 'specific';
    public const VISIBILITY_ALL = 'all';

    public const STATUS_ONLINE = 'online';
    public const STATUS_OFFLINE = 'offline';
    public const STATUS_UNAUTHORIZED = 'unauthorized';
    public const STATUS_UNKNOWN = 'unknown';

    protected $fillable = [
        'project_id',
        'device_name',
        'brand',
        'model',
        'ip_address',
        'http_port',
        'rtsp_port',
        'username',
        'password',
        'serial_number',
        'channel_count',
        'visibility',
        'status',
        'last_seen_at',
        'last_error',
        'is_active',
        'created_by',
    ];

    // Belt-and-braces: even an accidental ->toArray()/->toJson() cannot leak the credential.
    protected $hidden = [
        'password',
    ];

    protected $casts = [
        // First reversible encryption in this codebase. Keyed to APP_KEY — see
        // plainPassword() for the failure mode if APP_KEY is ever rotated.
        'password' => 'encrypted',
        'http_port' => 'integer',
        'rtsp_port' => 'integer',
        'channel_count' => 'integer',
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function channels()
    {
        return $this->hasMany(CameraChannel::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The sanctioned way to read the credential for building an RTSP/CGI URL.
     * Throws instead of returning garbage if APP_KEY was rotated after this
     * password was encrypted, so a caller gets a clear "re-enter credentials"
     * failure rather than an undecipherable string silently used in a request.
     */
    public function plainPassword(): string
    {
        try {
            return (string) $this->password;
        } catch (DecryptException $e) {
            throw new DecryptException(
                'Stored DVR credentials could not be decrypted (APP_KEY may have changed). '
                . 'Re-enter the device password.'
            );
        }
    }
}
