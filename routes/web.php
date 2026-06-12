<?php

use Illuminate\Support\Facades\Route;

// Shell único de la SPA: Vue Router maneja todas las rutas del cliente.
Route::view('/{any?}', 'app')->where('any', '^(?!api).*$');
