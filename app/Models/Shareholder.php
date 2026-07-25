<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shareholder extends Model
{
    protected $fillable = [
        'project_id',
        'user_id',
        'name',
        'email',
        'phone',
        'share_type',
        'ownership_pct',
        'share_count',
        'notes',
    ];

    protected $casts = [
        'ownership_pct' => 'float',
        'share_count' => 'integer',
    ];

    protected $appends = ['effective_ownership_pct', 'effective_share_count'];

    public function getEffectiveOwnershipPctAttribute()
    {
        if ($this->share_type === 'share_count') {
            $totalShares = $this->project?->total_shareholders ?? 0;
            if ($totalShares > 0 && $this->share_count > 0) {
                return round(($this->share_count / $totalShares) * 100, 2);
            }
        }
        return (float) ($this->ownership_pct ?? 0);
    }

    public function getEffectiveShareCountAttribute()
    {
        if ($this->share_type === 'percentage') {
            $totalShares = $this->project?->total_shareholders ?? 0;
            if ($totalShares > 0 && $this->ownership_pct > 0) {
                return round(($this->ownership_pct / 100) * $totalShares, 1);
            }
        }
        return (int) ($this->share_count ?? 0);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function investments()
    {
        return $this->hasMany(ShareholderInvestment::class);
    }
}
