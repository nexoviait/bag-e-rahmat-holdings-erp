<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShareholderInvestment extends Model
{
    protected $fillable = ['project_id', 'shareholder_id', 'amount', 'date', 'note', 'created_by'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function shareholder()
    {
        return $this->belongsTo(Shareholder::class);
    }
}
