<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

/**
 * Login con Google (Socialite). Google solo AUTENTICA la identidad; el desbloqueo
 * de la bóveda sigue requiriendo la clave maestra (zero-knowledge intacto). Por eso
 * el callback abre sesión y el cliente decide: setup de clave (cuenta nueva) o
 * pantalla de desbloqueo (cuenta ya configurada).
 */
class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable) {
            return redirect('/login?error=google');
        }

        // Vincula por google_id; si no, por email (cuenta creada con clave maestra).
        $user = User::where('google_id', $googleUser->getId())->first()
            ?? User::where('email', $googleUser->getEmail())->first();

        if (! $user) {
            $user = User::create([
                'email' => $googleUser->getEmail(),
                'name' => $googleUser->getName(),
                'google_id' => $googleUser->getId(),
            ]);
        } elseif (! $user->google_id) {
            $user->update(['google_id' => $googleUser->getId()]);
        }

        Auth::login($user);
        request()->session()->regenerate();

        // El cliente (router) enruta a /setup o /unlock según tenga protected_key.
        return redirect('/app');
    }
}
