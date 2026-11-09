<?php

use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Resiembra SOLO la cuenta demo: la instancia pública tiene además cuentas reales,
// así que nada de migrate:fresh. Se niega si la instancia no es la demo.
Artisan::command('demo:reset', function () {
    if (! config('demo.enabled')) {
        $this->error('Esta instancia no es la demo (APP_DEMO no está activo). No se tocó nada.');

        return 1;
    }

    $demo = User::where('email', config('demo.email'))->first();
    if ($demo) {
        DB::table('sessions')->where('user_id', $demo->id)->delete();
        $demo->tokens()->delete();
        $demo->delete(); // carpetas, entradas, etiquetas, campos y versiones caen en cascada
    }

    $this->callSilently('db:seed', ['--class' => DemoSeeder::class, '--force' => true]);
    $this->info('Cuenta demo resembrada.');
})->purpose('Vuelve la cuenta demo a su bóveda de ejemplo');

Schedule::command('demo:reset')->dailyAt('04:00')->when(fn () => config('demo.enabled'));
