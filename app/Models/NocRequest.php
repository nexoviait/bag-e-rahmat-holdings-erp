<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NocRequest extends Model
{
    protected $fillable = [
        'project_id',
        'requested_by',
        'purpose',
        'details',
        'status',
        'admin_notes',
        'document_path',
        'document_name',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
