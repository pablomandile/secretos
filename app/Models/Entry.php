<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Entry extends Model
{
    use HasUlids, SoftDeletes;

    protected $fillable = [
        'folder_id',
        'type',
        'title',
        'username',
        'password',
        'url',
        'notes',
        'favorite',
    ];

    protected function casts(): array
    {
        return [
            'type' => 'integer',
            'favorite' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }

    public function customFields(): HasMany
    {
        return $this->hasMany(CustomField::class)->orderBy('position');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(EntryVersion::class)->orderByDesc('version');
    }
}
