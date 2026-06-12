<?php

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA: sesión stateful + CSRF para el cliente Vue del mismo origen.
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Nunca flashear material sensible a la sesión en errores de validación.
        $exceptions->dontFlash([
            'verifier',
            'current_verifier',
            'protected_key',
            'password',
            'password_confirmation',
        ]);
    })->create();
