<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectDocument extends Model
{
    use HasFactory;

    public const VISIBILITY_ADMIN_ONLY = 'admin_only';
    public const VISIBILITY_SPECIFIC = 'specific';
    public const VISIBILITY_ALL = 'all';

    protected $fillable = [
        'project_id',
        'name',
        'document_type',
        'description',
        'file_name',
        'file_path',
        'mime_type',
        'file_size',
        'uploaded_by',
        'visibility',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function assignees()
    {
        return $this->belongsToMany(User::class, 'project_document_assignees')->withTimestamps();
    }
}
