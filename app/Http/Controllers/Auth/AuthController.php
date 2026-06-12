<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\PreloginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Paso 1 del login: el cliente pide los parámetros KDF + salt para re-derivar
     * la clave. Para emails inexistentes devolvemos valores por defecto y un salt
     * falso determinístico (anti-enumeración: indistinguible de una cuenta real).
     */
    public function prelogin(PreloginRequest $request): JsonResponse
    {
        $email = $request->string('email');
        $user = User::where('email', $email)->first();

        if ($user) {
            return response()->json($user->kdfParams());
        }

        return response()->json([
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => $this->fakeSalt($email),
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'email' => $data['email'],
            'name' => $data['name'] ?? null,
            'password' => Hash::make($data['verifier']),
            'kdf_type' => $data['kdf_type'],
            'kdf_memory' => $data['kdf_memory'],
            'kdf_iterations' => $data['kdf_iterations'],
            'kdf_parallelism' => $data['kdf_parallelism'],
            'kdf_salt' => $data['kdf_salt'],
            'protected_key' => $data['protected_key'],
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($this->sessionPayload($user), 201);
    }

    /**
     * Paso 2 del login: el cliente envía el verifier derivado. El servidor lo
     * compara (re-hasheado) y, si coincide, abre sesión y entrega el protected_key.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check($request->string('verifier'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Credenciales inválidas.',
            ]);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($this->sessionPayload($user));
    }

    /**
     * Datos para la pantalla de desbloqueo tras un refresh (sesión viva, claves
     * perdidas en memoria). El desbloqueo en sí es 100% local.
     */
    public function session(Request $request): JsonResponse
    {
        return response()->json($this->sessionPayload($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(null, 204);
    }

    private function sessionPayload(User $user): array
    {
        return [
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'auto_lock_minutes' => $user->auto_lock_minutes,
            ],
            'kdf' => $user->kdfParams(),
            'protected_key' => $user->protected_key,
            'key_version' => $user->key_version,
        ];
    }

    private function fakeSalt(string $email): string
    {
        $hmac = hash_hmac('sha256', $email, config('app.key'), true);

        return base64_encode(substr($hmac, 0, 16)); // 24 chars, igual que un salt real
    }
}
