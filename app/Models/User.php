<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'is_active',
        'avatar_path',
        'last_seen_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    public function assignments()
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class, 'project_assignments');
    }

    public function shareholder()
    {
        return $this->hasOne(Shareholder::class);
    }

    public function assignedCameras()
    {
        return $this->belongsToMany(CameraChannel::class, 'camera_user_assignments')->withTimestamps();
    }

    public function conversationParticipants()
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function conversations()
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot(['role', 'muted', 'joined_at', 'left_at', 'last_read_message_id', 'last_read_at'])
            ->withTimestamps();
    }
}
