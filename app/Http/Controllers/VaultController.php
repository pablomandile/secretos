<?php

namespace App\Http\Controllers;

use App\Http\Resources\EntryResource;
use App\Http\Resources\FolderResource;
use App\Http\Resources\TagResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VaultController extends Controller
{
    /**
     * Payload de arranque de la bóveda en un solo round-trip. Devuelve solo
     * ciphertext + metadata; el cliente descifra todo localmente. Excluye la
     * papelera (entradas con deleted_at).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'folders' => FolderResource::collection($user->folders()->orderBy('position')->get()),
            'tags' => TagResource::collection($user->tags()->get()),
            'entries' => EntryResource::collection(
                $user->entries()->with(['customFields', 'tags:id'])->get()
            ),
        ]);
    }
}
