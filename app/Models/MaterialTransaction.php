<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialTransaction extends Model
{
    public const TYPE_IN = 'in';
    public const TYPE_OUT = 'out';

    protected $fillable = [
        'project_id',
        'material_id',
        'type',
        'date',
        'quantity',
        'unit_price',
        'total_cost',
        'supplier',
        'used_for',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'quantity' => 'float',
        'unit_price' => 'float',
        'total_cost' => 'float',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function material()
    {
        return $this->belongsTo(Material::class);
    }
}
