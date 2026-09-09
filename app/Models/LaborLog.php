<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LaborLog extends Model
{
    protected $fillable = [
        'project_id',
        'date',
        'labor_type',
        'headcount',
        'wage_rate',
        'total_cost',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'headcount' => 'integer',
        'wage_rate' => 'float',
        'total_cost' => 'float',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
