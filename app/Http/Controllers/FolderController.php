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
        $model->update($request->validated());

        return new FolderResource($model);
    }

    /**
     * Al borrar: las subcarpetas pasan a raíz y las entradas quedan sin carpeta
     * (nullOnDelete en las FK). No se borran entradas.
     */
    public function destroy(Request $request, string $folder): JsonResponse
    {
        $request->user()->folders()->findOrFail($folder)->delete();

        return response()->json(null, 204);
    }
}
