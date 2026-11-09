<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Crea la cuenta demo con la bóveda de demo/boveda.json, ya cifrada en el cliente
 * (ver resources/js/demo/bovedaDemo.ts). Las fechas se calculan desde hoy, para
 * que la demo siempre se vea al día.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $boveda = json_decode(file_get_contents(__DIR__.'/demo/boveda.json'), true, flags: JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($boveda) {
            $user = User::create([
                'email' => config('demo.email'),
                'name' => 'Demo',
                'password' => Hash::make($boveda['verifier']),
                'kdf_type' => $boveda['kdf']['type'],
                'kdf_memory' => $boveda['kdf']['memory'],
                'kdf_iterations' => $boveda['kdf']['iterations'],
                'kdf_parallelism' => $boveda['kdf']['parallelism'],
                'kdf_salt' => $boveda['kdf']['salt'],
                'protected_key' => $boveda['protected_key'],
            ]);

            $carpetas = [];
            foreach ($boveda['folders'] as $f) {
                $carpetas[$f['clave']] = $user->folders()->create([
                    'parent_id' => $f['padre'] ? $carpetas[$f['padre']] : null,
                    'name' => $f['name'],
                    'position' => $f['position'],
                ])->id;
            }

            $etiquetas = [];
            foreach ($boveda['tags'] as $t) {
                $etiquetas[$t['clave']] = $user->tags()->create(['name' => $t['name'], 'color' => $t['color']])->id;
            }

            foreach ($boveda['entries'] as $e) {
                $fecha = now()->subDays($e['dias_atras'])->subMinutes(crc32($e['title']) % 600);
                $entry = $user->entries()->make([
                    'folder_id' => $e['carpeta'] ? $carpetas[$e['carpeta']] : null,
                    'type' => $e['type'],
                    'title' => $e['title'],
                    'username' => $e['username'],
                    'password' => $e['password'],
                    'url' => $e['url'],
                    'notes' => $e['notes'],
                    'favorite' => $e['favorite'],
                ]);
                $entry->id = (string) Str::ulid($fecha);
                $entry->created_at = $entry->updated_at = $fecha;
                $entry->save();

                foreach ($e['custom_fields'] as $campo) {
                    $entry->customFields()->create($campo);
                }
                $entry->tags()->sync(array_map(fn ($clave) => $etiquetas[$clave], $e['etiquetas']));
            }
        });
    }
}
