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
        if (app()->environment('production')) {
            $response->headers->set(
                'Content-Security-Policy',
                "default-src 'self'; ".
                "script-src 'self'; ".
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
