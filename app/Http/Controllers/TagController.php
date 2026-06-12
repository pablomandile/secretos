<?php

namespace App\Http\Controllers;

use App\Http\Requests\TagRequest;
use App\Http\Resources\TagResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function store(TagRequest $request): TagResource
    {
        $tag = $request->user()->tags()->create($request->validated());

        return new TagResource($tag);
    }

    public function update(TagRequest $request, string $tag): TagResource
    {
        $model = $request->user()->tags()->findOrFail($tag);
        $model->update($request->validated());

        return new TagResource($model);
    }

    public function destroy(Request $request, string $tag): JsonResponse
    {
        // El pivote entry_tag se limpia por cascade.
        $request->user()->tags()->findOrFail($tag)->delete();

        return response()->json(null, 204);
    }
}
