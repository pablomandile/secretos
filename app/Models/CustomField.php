<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomField extends Model
{
    public $timestamps = false;

    protected $fillable = ['label', 'value', 'type', 'protected', 'position'];

    protected function casts(): array
    {
        return [
            'type' => 'integer',
            'protected' => 'boolean',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(Entry::class);
    }
}
