<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Stubs del roadmap (fase futura). El export/import en un modelo zero-knowledge
 * ocurre en el cliente: el navegador descifra y arma un backup cifrado, o lee un
 * KDBX/CSV y cifra antes de subir. El servidor solo movería ciphertext, por lo
 * que es probable que estos endpoints terminen siendo innecesarios o mínimos.
 */
class ImportExportController extends Controller
{
    public function export(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Export aún no implementado. El backup cifrado se generará en el cliente.',
        ], 501);
    }

    public function import(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Import aún no implementado. La importación de KeePass/CSV se hará en el cliente.',
        ], 501);
    }
}
