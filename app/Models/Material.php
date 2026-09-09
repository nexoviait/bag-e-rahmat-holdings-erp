<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    protected $fillable = [
        'project_id',
        'name',
        'unit',
        'reorder_level',
        'notes',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'reorder_level' => 'float',
        'is_active' => 'boolean',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function transactions()
    {
        return $this->hasMany(MaterialTransaction::class);
    }
}
