<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'google_id',
        'password',
        'kdf_type',
        'kdf_memory',
        'kdf_iterations',
        'kdf_parallelism',
        'kdf_salt',
        'protected_key',
        'key_version',
        'auto_lock_minutes',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'kdf_type' => 'integer',
            'kdf_memory' => 'integer',
            'kdf_iterations' => 'integer',
            'kdf_parallelism' => 'integer',
            'key_version' => 'integer',
            'auto_lock_minutes' => 'integer',
        ];
    }

    /** Parámetros KDF que el cliente necesita para re-derivar la clave. */
    public function kdfParams(): array
    {
        return [
            'kdf_type' => $this->kdf_type,
            'kdf_memory' => $this->kdf_memory,
            'kdf_iterations' => $this->kdf_iterations,
            'kdf_parallelism' => $this->kdf_parallelism,
            'kdf_salt' => $this->kdf_salt,
        ];
    }

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(Entry::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class);
    }
}
