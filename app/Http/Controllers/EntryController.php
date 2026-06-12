<?php

namespace App\Http\Controllers;

use App\Http\Requests\EntryRequest;
use App\Http\Resources\EntryResource;
use App\Models\Entry;
use App\Support\EntryVersioning;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EntryController extends Controller
{
    public function store(EntryRequest $request): EntryResource
    {
        $data = $request->validated();

        $entry = $request->user()->entries()->create($this->entryAttributes($data));
        $this->syncCustomFields($entry, $data['custom_fields'] ?? []);
        $entry->tags()->sync($data['tag_ids'] ?? []);

        return new EntryResource($entry->load(['customFields', 'tags:id']));
    }

    public function update(EntryRequest $request, string $entry): EntryResource
    {
        $model = $request->user()->entries()->findOrFail($entry);
        $data = $request->validated();

        // Snapshot del estado actual ANTES de modificar (historial estilo KeePass).
        EntryVersioning::snapshot($model);

        $model->update($this->entryAttributes($data));
        $this->syncCustomFields($model, $data['custom_fields'] ?? []);
        $model->tags()->sync($data['tag_ids'] ?? []);

        return new EntryResource($model->fresh()->load(['customFields', 'tags:id']));
    }

    /** Cambios de solo-metadata (favorito, mover de carpeta). Sin versionar. */
    public function updateMeta(Request $request, string $entry): EntryResource
    {
        $model = $request->user()->entries()->findOrFail($entry);

        $validated = $request->validate([
            'favorite' => ['sometimes', 'boolean'],
            'folder_id' => [
                'sometimes',
                'nullable',
                Rule::exists('folders', 'id')->where('user_id', $request->user()->id),
            ],
        ]);

        $model->update($validated);

        return new EntryResource($model->load(['customFields', 'tags:id']));
    }

    /** Borrado suave → papelera de reciclaje. */
    public function destroy(Request $request, string $entry): JsonResponse
    {
        $request->user()->entries()->findOrFail($entry)->delete();

        return response()->json(null, 204);
    }

    /** Listado de la papelera (entradas con deleted_at). */
    public function trash(Request $request): JsonResponse
    {
        $entries = $request->user()->entries()->onlyTrashed()
            ->with(['customFields', 'tags:id'])->get();

        return response()->json(['entries' => EntryResource::collection($entries)]);
    }

    public function restore(Request $request, string $entry): EntryResource
    {
        $model = $request->user()->entries()->onlyTrashed()->findOrFail($entry);
        $model->restore();

        return new EntryResource($model->load(['customFields', 'tags:id']));
    }

    /** Purga permanente desde la papelera (entrada + versiones, por cascade). */
    public function forceDestroy(Request $request, string $entry): JsonResponse
    {
        $request->user()->entries()->withTrashed()->findOrFail($entry)->forceDelete();

        return response()->json(null, 204);
    }

    private function entryAttributes(array $data): array
    {
        return [
            'folder_id' => $data['folder_id'] ?? null,
            'type' => $data['type'],
            'title' => $data['title'],
            'username' => $data['username'] ?? null,
            'password' => $data['password'] ?? null,
            'url' => $data['url'] ?? null,
            'notes' => $data['notes'] ?? null,
            'favorite' => $data['favorite'] ?? false,
        ];
    }

    /** Reemplaza los campos personalizados (no tienen id estable del lado cliente). */
    private function syncCustomFields(Entry $entry, array $fields): void
    {
        $entry->customFields()->delete();
        foreach ($fields as $field) {
            $entry->customFields()->create([
                'label' => $field['label'],
                'value' => $field['value'],
                'type' => $field['type'],
                'protected' => $field['protected'] ?? false,
                'position' => $field['position'] ?? 0,
            ]);
        }
    }
}
