<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Budget extends Model
{
    protected $fillable = [
        'project_id', 'category', 'description', 'date', 'amount', 'created_by',
        'receipt_path', 'receipt_name', 'receipt_mime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
