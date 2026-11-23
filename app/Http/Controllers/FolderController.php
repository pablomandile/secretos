<?php

namespace App\Http\Controllers;

use App\Http\Requests\FolderRequest;
use App\Http\Resources\FolderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FolderController extends Controller
{
    public function store(FolderRequest $request): FolderResource
    {
        $folder = $request->user()->folders()->create($request->validated());

        return new FolderResource($folder);
    }

    public function update(FolderRequest $request, string $folder): FolderResource
    {
        $model = $request->user()->folders()->findOrFail($folder);
        $data = $request->validated();

        if (! empty($data['parent_id'])) {
            $this->assertNoCycle($request, $model->id, $data['parent_id']);
        }

        $model->update($data);

        return new FolderResource($model);
    }

    /**
     * Evita mover una carpeta dentro de sí misma o de una de sus descendientes
     * (crearía un ciclo). Sube por la cadena de padres desde el nuevo padre; si
     * topa con la propia carpeta, aborta.
     */
    private function assertNoCycle(Request $request, string $folderId, string $newParentId): void
    {
        $parents = $request->user()->folders()->pluck('parent_id', 'id'); // id => parent_id
        $cursor = $newParentId;
        $steps = 0;
        while ($cursor !== null) {
            if ($cursor === $folderId) {
                abort(422, 'No podés mover una carpeta dentro de sí misma o de una subcarpeta suya.');
            }
            $cursor = $parents->get($cursor);
            if (++$steps > 10000) {
                break; // salvaguarda ante datos corruptos
            }
        }
    }

    /**
     * Solo se borra una carpeta vacía: sin subcarpetas ni entradas activas.
     * Las entradas que estén en la papelera quedan sin carpeta (nullOnDelete
     * en la FK), así que si se restauran aparecen en "Sin carpeta".
     */
    public function destroy(Request $request, string $folder): JsonResponse
    {
        $model = $request->user()->folders()->findOrFail($folder);

        if ($model->children()->exists() || $model->entries()->exists()) {
            abort(422, 'Solo se puede eliminar una carpeta vacía (sin claves ni subcarpetas).');
        }

        $model->delete();

        return response()->json(null, 204);
    }
}
