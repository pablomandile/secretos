<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Entry */
class EntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'folder_id' => $this->folder_id,
            'title' => $this->title,
            'username' => $this->username,
            'password' => $this->password,
            'url' => $this->url,
            'notes' => $this->notes,
            'favorite' => $this->favorite,
            'custom_fields' => $this->whenLoaded('customFields', fn () => $this->customFields->map(fn ($f) => [
                'id' => $f->id,
                'label' => $f->label,
                'value' => $f->value,
                'type' => $f->type,
                'protected' => $f->protected,
                'position' => $f->position,
            ])),
            'tag_ids' => $this->whenLoaded('tags', fn () => $this->tags->pluck('id')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
        ];
    }
}
