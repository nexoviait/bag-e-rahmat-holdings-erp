<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    protected $fillable = [
        'owner_id',
        'title',
        'type',
        'location',
        'description',
        'estimated_value',
        'status',
    ];

    protected $casts = [
        'estimated_value' => 'decimal:2',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function documents()
    {
        return $this->hasMany(PropertyDocument::class);
    }

    public function requests()
    {
        return $this->hasMany(PropertyRequest::class);
    }
}
