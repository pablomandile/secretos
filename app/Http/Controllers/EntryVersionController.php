<?php

namespace App\Http\Controllers;

use App\Http\Resources\EntryResource;
use App\Models\Entry;
use App\Support\EntryVersioning;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntryVersionController extends Controller
{
    /** Lista liviana de versiones (sin cuerpos): {id, version, created_at}. */
    public function index(Request $request, string $entry): JsonResponse
    {
        $model = $this->resolveEntry($request, $entry);

        $versions = $model->versions()->get(['id', 'version', 'created_at']);

        return response()->json(['versions' => $versions]);
    }

    /** Snapshot completo (ciphertext) para que el cliente lo descifre y compare. */
    public function show(Request $request, string $entry, int $version): JsonResponse
    {
        $model = $this->resolveEntry($request, $entry);
        $snapshot = $model->versions()->findOrFail($version);

        return response()->json([
            'id' => $snapshot->id,
            'version' => $snapshot->version,
            'created_at' => $snapshot->created_at,
            'title' => $snapshot->title,
            'username' => $snapshot->username,
            'password' => $snapshot->password,
            'url' => $snapshot->url,
            'notes' => $snapshot->notes,
            'folder_id' => $snapshot->folder_id,
            'custom_fields' => $snapshot->custom_fields,
        ]);
    }

    /** Restaura una versión: versiona el estado actual y luego lo reemplaza. */
    public function restore(Request $request, string $entry, int $version): EntryResource
    {
        $model = $this->resolveEntry($request, $entry);
        $snapshot = $model->versions()->findOrFail($version);

        EntryVersioning::snapshot($model);

        $model->update([
            'title' => $snapshot->title,
            'username' => $snapshot->username,
            'password' => $snapshot->password,
            'url' => $snapshot->url,
            'notes' => $snapshot->notes,
            'folder_id' => $snapshot->folder_id,
        ]);

        $model->customFields()->delete();
        foreach ($snapshot->custom_fields ?? [] as $field) {
            $model->customFields()->create($field);
        }

        return new EntryResource($model->fresh()->load(['customFields', 'tags:id']));
    }

    private function resolveEntry(Request $request, string $entry): Entry
    {
        return $request->user()->entries()->withTrashed()->findOrFail($entry);
    }
}
