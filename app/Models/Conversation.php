<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'type',
        'name',
        'avatar_path',
        'direct_key',
        'created_by',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function participants()
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function activeParticipants()
    {
        return $this->hasMany(ConversationParticipant::class)->whereNull('left_at');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'conversation_participants')
            ->withPivot(['role', 'muted', 'joined_at', 'left_at', 'last_read_message_id', 'last_read_at'])
            ->withTimestamps();
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}
