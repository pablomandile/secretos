<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $verifier;

    /**
     * Estado por defecto: valores con forma válida (no derivados de una clave real).
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            // Hash de un verifier de 44 chars (placeholder).
            'password' => static::$verifier ??= Hash::make(str_repeat('A', 43).'='),
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => base64_encode(random_bytes(16)),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
            'key_version' => 1,
            'auto_lock_minutes' => 5,
        ];
    }
}
