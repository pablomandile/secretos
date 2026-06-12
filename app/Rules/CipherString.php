<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida que un valor tenga forma de ciphertext "vN.base64(iv).base64(ct)".
 * No descifra nada (el servidor no puede): solo verifica la forma, evitando que
 * se cuele texto plano por error del cliente.
 */
class CipherString implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/^v\d+\.[A-Za-z0-9+\/=]+\.[A-Za-z0-9+\/=]+$/', $value)) {
            $fail('El campo :attribute debe estar cifrado.');
        }
    }
}
