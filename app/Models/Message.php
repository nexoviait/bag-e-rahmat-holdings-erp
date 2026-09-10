<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'type',
        'body',
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'attachment_duration_ms',
        'reply_to_message_id',
    ];

    protected $casts = [
        'attachment_size' => 'integer',
        'attachment_duration_ms' => 'integer',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyToMessage()
    {
        return $this->belongsTo(Message::class, 'reply_to_message_id');
    }
}
