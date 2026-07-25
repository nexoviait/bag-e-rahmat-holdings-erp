<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Budget extends Model
{
    protected $fillable = ['project_id', 'category', 'description', 'date', 'amount', 'created_by'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
