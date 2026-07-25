<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'status',
        'total_shareholder_project_price',
        'total_shareholders',
        'start_date',
        'end_date',
        'created_by',
    ];

    protected $casts = [
        'total_shareholder_project_price' => 'float',
        'total_shareholders' => 'integer',
    ];

    protected $appends = ['per_share_price', 'allocated_share_count', 'available_share_count', 'allocated_pct'];

    public function getPerSharePriceAttribute()
    {
        if ($this->total_shareholders > 0 && $this->total_shareholder_project_price > 0) {
            return round($this->total_shareholder_project_price / $this->total_shareholders, 2);
        }
        return 0.00;
    }

    public function getAllocatedShareCountAttribute()
    {
        $totalSh = $this->total_shareholders;
        if (!$totalSh || $totalSh <= 0) return 0;

        $shareholders = $this->shareholders()->get();
        $sum = 0;
        foreach ($shareholders as $sh) {
            if ($sh->share_type === 'share_count') {
                $sum += $sh->share_count;
            } else if ($sh->ownership_pct > 0) {
                $sum += ($sh->ownership_pct / 100) * $totalSh;
            }
        }
        return round($sum, 2);
    }

    public function getAvailableShareCountAttribute()
    {
        $totalSh = $this->total_shareholders;
        if (!$totalSh || $totalSh <= 0) return 999999;
        return max(0, round($totalSh - $this->allocated_share_count, 2));
    }

    public function getAllocatedPctAttribute()
    {
        $shareholders = $this->shareholders()->get();
        $totalSh = $this->total_shareholders;
        $sum = 0;
        foreach ($shareholders as $sh) {
            if ($sh->share_type === 'percentage') {
                $sum += $sh->ownership_pct;
            } else if ($totalSh > 0 && $sh->share_count > 0) {
                $sum += ($sh->share_count / $totalSh) * 100;
            }
        }
        return round($sum, 2);
    }

    public function assignments()
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'project_assignments');
    }

    public function budgets()
    {
        return $this->hasMany(Budget::class);
    }

    public function revenues()
    {
        return $this->hasMany(Revenue::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function ownerPayments()
    {
        return $this->hasMany(OwnerPayment::class);
    }

    public function shareholders()
    {
        return $this->hasMany(Shareholder::class);
    }

    public function shareholderInvestments()
    {
        return $this->hasMany(ShareholderInvestment::class);
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }
}
