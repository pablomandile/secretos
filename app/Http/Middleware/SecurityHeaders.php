<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        // 'same-origin' (no 'no-referrer'): el SPA necesita mandar el Referer en
        // sus requests del mismo origen para que Sanctum las detecte como stateful
        // (los GET same-origin no llevan Origin). No se filtra referrer cross-origin.
        $response->headers->set('Referrer-Policy', 'same-origin');

        // CSP estricta solo en producción: en local rompería el HMR de Vite.
        // 'unsafe-inline' en style-src porque PrimeVue inyecta estilos en línea.
        // 'wasm-unsafe-eval' en script-src: Argon2id (hash-wasm) compila WebAssembly;
        // habilita solo WASM, no eval() de JS.
        if (app()->environment('production')) {
            $response->headers->set(
                'Content-Security-Policy',
                "default-src 'self'; ".
                "script-src 'self' 'wasm-unsafe-eval'; ".
                "style-src 'self' 'unsafe-inline'; ".
                "img-src 'self' data:; ".
                "font-src 'self' data:; ".
                "connect-src 'self'; ".
                "frame-ancestors 'none'; ".
                "base-uri 'self'; ".
                "form-action 'self'"
            );
        }

        return $response;
    }
}
