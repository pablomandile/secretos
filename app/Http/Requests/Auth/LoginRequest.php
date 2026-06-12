<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'verifier' => ['required', 'string', 'size:44', 'regex:/^[A-Za-z0-9+\/=]+$/'],
        ];
    }
}
