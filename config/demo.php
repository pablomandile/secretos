<?php

/*
 * Cuenta demo de la instancia pública (secretos.bambudev.com.ar).
 *
 * Todo lo de la demo actúa solo con APP_DEMO=true: el mismo código va a la
 * instancia personal de pablomandile, apagado. La contraseña tiene que ser la
 * misma con la que se cifró database/seeders/demo/boveda.json.
 */

return [
    'enabled' => (bool) env('APP_DEMO', false),
    'email' => env('DEMO_EMAIL', 'demo@bambudev.com.ar'),
    'password' => env('DEMO_PASSWORD', 'demo1234'),
];
