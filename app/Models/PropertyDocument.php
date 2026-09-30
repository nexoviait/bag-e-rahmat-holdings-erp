<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PropertyDocument extends Model
{
    protected $fillable = [
        'property_id',
        'label',
        'file_path',
        'file_name',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }
}
