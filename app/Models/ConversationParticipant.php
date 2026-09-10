<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ConversationParticipant extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'role',
        'muted',
        'joined_at',
        'left_at',
        'last_read_message_id',
        'last_read_at',
    ];

    protected $casts = [
        'muted' => 'boolean',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'last_read_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lastReadMessage()
    {
        return $this->belongsTo(Message::class, 'last_read_message_id');
    }
}
