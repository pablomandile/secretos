<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntryVersion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'version',
        'title',
        'username',
        'password',
        'url',
        'notes',
        'folder_id',
        'custom_fields',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'custom_fields' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(Entry::class);
    }
}
