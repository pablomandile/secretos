<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    /**
     * Cambio de clave maestra. El cliente re-envuelve la vaultKey bajo la nueva
     * clave (los items NO se re-cifran). Verificamos el verifier actual, swap, y
     * cerramos el resto de las sesiones del usuario.
     */
    public function updateMasterPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_verifier' => ['required', 'string', 'size:44'],
            'verifier' => ['required', 'string', 'size:44', 'regex:/^[A-Za-z0-9+\/=]+$/'],
            'kdf_type' => ['required', 'integer', 'in:1'],
            'kdf_memory' => ['required', 'integer', 'min:8192', 'max:1048576'],
            'kdf_iterations' => ['required', 'integer', 'min:1', 'max:10'],
            'kdf_parallelism' => ['required', 'integer', 'min:1', 'max:16'],
            'kdf_salt' => ['required', 'string', 'size:24', 'regex:/^[A-Za-z0-9+\/=]+$/'],
            'protected_key' => ['required', 'string', 'regex:/^v\d+\.[A-Za-z0-9+\/=]+\.[A-Za-z0-9+\/=]+$/'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_verifier'], $user->password)) {
            throw ValidationException::withMessages([
                'current_verifier' => 'La contraseña maestra actual es incorrecta.',
            ]);
        }

        $user->update([
            'password' => Hash::make($data['verifier']),
            'kdf_type' => $data['kdf_type'],
            'kdf_memory' => $data['kdf_memory'],
            'kdf_iterations' => $data['kdf_iterations'],
            'kdf_parallelism' => $data['kdf_parallelism'],
            'kdf_salt' => $data['kdf_salt'],
            'protected_key' => $data['protected_key'],
        ]);

        // Cierra las demás sesiones (otros dispositivos) salvo la actual.
        DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        return response()->json(['key_version' => $user->key_version]);
    }

    /** Preferencias en texto plano (auto-bloqueo). */
    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'auto_lock_minutes' => ['required', 'integer', 'min:1', 'max:120'],
        ]);

        $request->user()->update($data);

        return response()->json($data);
    }
}
