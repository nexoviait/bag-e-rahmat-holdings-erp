<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Call extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'conversation_id',
        'type',
        'status',
        'initiated_by',
        'started_at',
        'ended_at',
        'end_reason',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function initiator()
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function participants()
    {
        return $this->hasMany(CallParticipant::class);
    }
}
