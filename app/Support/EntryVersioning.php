<?php

namespace App\Support;

use App\Models\Entry;
use App\Models\EntryVersion;

class EntryVersioning
{
    /** Máximo de versiones retenidas por entrada (estilo historial de KeePass). */
    public const MAX_VERSIONS = 20;

    /**
     * Guarda el estado ACTUAL de la entrada como una nueva versión (snapshot de
     * ciphertext: el servidor versiona sin poder leer nada). Debe llamarse ANTES
     * de aplicar cambios, para que el historial contenga los estados anteriores.
     * Poda a las MAX_VERSIONS más recientes.
     */
    public static function snapshot(Entry $entry): void
    {
        $next = ($entry->versions()->max('version') ?? 0) + 1;

        $entry->versions()->create([
            'version' => $next,
            'title' => $entry->title,
            'username' => $entry->username,
            'password' => $entry->password,
            'url' => $entry->url,
            'notes' => $entry->notes,
            'folder_id' => $entry->folder_id,
            'custom_fields' => $entry->customFields()->get()->map(fn ($f) => [
                'label' => $f->label,
                'value' => $f->value,
                'type' => $f->type,
                'protected' => $f->protected,
                'position' => $f->position,
            ])->all(),
            'created_at' => now(),
        ]);

        $stale = $entry->versions()->orderByDesc('version')->pluck('id')->slice(self::MAX_VERSIONS);
        if ($stale->isNotEmpty()) {
            EntryVersion::whereIn('id', $stale)->delete();
        }
    }
}
