<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PropertyRequest extends Model
{
    protected $fillable = [
        'property_id',
        'owner_id',
        'kind',
        'asking_price',
        'details',
        'status',
        'admin_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'asking_price' => 'decimal:2',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
