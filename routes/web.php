<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use Illuminate\Support\Facades\Route;

// Login con Google (Socialite) — flujo de redirección del navegador.
Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('google.redirect');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');

// Shell único de la SPA: Vue Router maneja todas las rutas del cliente.
Route::view('/{any?}', 'app')->where('any', '^(?!api).*$');
