<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\EntryController;
use App\Http\Controllers\EntryVersionController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\ImportExportController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\VaultController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('prelogin', [AuthController::class, 'prelogin'])->middleware('throttle:10,1');
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('session', [AuthController::class, 'session']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('setup-key', [AuthController::class, 'setupKey']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('vault', [VaultController::class, 'index']);

    Route::get('trash', [EntryController::class, 'trash']);

    Route::post('entries', [EntryController::class, 'store']);
    Route::post('entries/bulk-delete', [EntryController::class, 'bulkDestroy']);
    Route::put('entries/{entry}', [EntryController::class, 'update']);
    Route::patch('entries/{entry}', [EntryController::class, 'updateMeta']);
    Route::delete('entries/{entry}', [EntryController::class, 'destroy']);
    Route::post('entries/{entry}/restore', [EntryController::class, 'restore']);
    Route::delete('entries/{entry}/force', [EntryController::class, 'forceDestroy']);

    Route::get('entries/{entry}/versions', [EntryVersionController::class, 'index']);
    Route::get('entries/{entry}/versions/{version}', [EntryVersionController::class, 'show']);
    Route::post('entries/{entry}/versions/{version}/restore', [EntryVersionController::class, 'restore']);

    Route::post('folders', [FolderController::class, 'store']);
    Route::put('folders/{folder}', [FolderController::class, 'update']);
    Route::delete('folders/{folder}', [FolderController::class, 'destroy']);

    Route::post('tags', [TagController::class, 'store']);
    Route::put('tags/{tag}', [TagController::class, 'update']);
    Route::delete('tags/{tag}', [TagController::class, 'destroy']);

    Route::put('account/master-password', [AccountController::class, 'updateMasterPassword'])->middleware('throttle:10,1');
    Route::patch('account/preferences', [AccountController::class, 'updatePreferences']);

    // Roadmap (stubs 501): backup cifrado e import KeePass/CSV, ambos del lado cliente.
    Route::get('export', [ImportExportController::class, 'export']);
    Route::post('import', [ImportExportController::class, 'import']);
});
