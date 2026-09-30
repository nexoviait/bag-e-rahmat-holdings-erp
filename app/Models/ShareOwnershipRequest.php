<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShareOwnershipRequest extends Model
{
    protected $fillable = [
        'shareholder_id',
        'kind',
        'to_user_id',
        'to_name',
        'to_email',
        'to_phone',
        'percentage',
        'share_count',
        'sale_price',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'created_by',
    ];

    protected $casts = [
        'percentage' => 'float',
        'share_count' => 'integer',
        'sale_price' => 'float',
        'approved_at' => 'datetime',
    ];

    public function shareholder()
    {
        return $this->belongsTo(Shareholder::class);
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
