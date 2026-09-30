<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'is_active',
        'avatar_path',
        'last_seen_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    public function assignments()
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class, 'project_assignments');
    }

    public function shareholder()
    {
        return $this->hasOne(Shareholder::class);
    }

    public function nominee()
    {
        return $this->hasOne(Nominee::class);
    }

    /**
     * The shareholder record this user's own "my equity/investments" views
     * (OverviewTab, ShareholdersTab) should personalize around — either a
     * real Shareholder row of their own, or, for an approved nominee, the
     * shareholder they represent. A nominee has no Shareholder row of their
     * own (their ownership_percentage lives on the `nominees` row instead),
     * so without this every "show MY share" screen would find nothing.
     */
    public function linkedShareholder(): ?Shareholder
    {
        if ($this->shareholder) {
            return $this->shareholder;
        }

        $nominee = $this->nominee;
        if ($nominee && $nominee->status === 'approved') {
            return $nominee->shareholder;
        }

        return null;
    }

    /**
     * The fraction (0-100) of linkedShareholder()'s equity this user actually
     * represents — null for a real shareholder (their own full 100%), or the
     * nominee's own ownership_percentage for an approved nominee. Lets "my
     * share" screens (OverviewTab, ShareholdersTab) show the nominee's real
     * slice instead of the whole shareholder's numbers.
     */
    public function nomineeSharePercentage(): ?float
    {
        if ($this->shareholder) {
            return null;
        }

        $nominee = $this->nominee;
        if ($nominee && $nominee->status === 'approved') {
            return (float) $nominee->ownership_percentage;
        }

        return null;
    }

    /**
     * Single source of truth for "can this user touch project #$projectId
     * at all" — super_admin/admin get the same blanket oversight bypass used
     * everywhere else in this app (CCTV, Documents, Materials, Chat's own
     * viewAny), everyone else needs a real ProjectAssignment row. Introduced
     * because FinancialController and ReportController's project-scoped
     * endpoints had NO such check at all — any authenticated user could read
     * (and Financial's could write) any other project's financial/report
     * data just by knowing its id.
     */
    public function canAccessProject(int $projectId): bool
    {
        return $this->hasAnyRole(['super_admin', 'admin']) || $this->projects->contains($projectId);
    }

    public function assignedCameras()
    {
        return $this->belongsToMany(CameraChannel::class, 'camera_user_assignments')->withTimestamps();
    }

    public function conversationParticipants()
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function conversations()
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot(['role', 'muted', 'joined_at', 'left_at', 'last_read_message_id', 'last_read_at'])
            ->withTimestamps();
    }
}
