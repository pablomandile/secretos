<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'name' => ['nullable', 'string', 'max:100'],

            // Parámetros KDF dentro de límites sanos (evita DoS por memoria/tiempo absurdos).
            'kdf_type' => ['required', 'integer', 'in:1'],
            'kdf_memory' => ['required', 'integer', 'min:8192', 'max:1048576'],
            'kdf_iterations' => ['required', 'integer', 'min:1', 'max:10'],
            'kdf_parallelism' => ['required', 'integer', 'min:1', 'max:16'],
            'kdf_salt' => ['required', 'string', 'size:24', 'regex:/^[A-Za-z0-9+\/=]+$/'],

            // verifier = base64 de 32 bytes (44 chars con padding).
            'verifier' => ['required', 'string', 'size:44', 'regex:/^[A-Za-z0-9+\/=]+$/'],

            // protected_key = ciphertext "v1.iv.ct".
            'protected_key' => ['required', 'string', 'regex:/^v\d+\.[A-Za-z0-9+\/=]+\.[A-Za-z0-9+\/=]+$/'],
        ];
    }
}
