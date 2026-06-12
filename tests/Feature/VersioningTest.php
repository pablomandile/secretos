<?php

namespace Tests\Feature;

use App\Models\Entry;
use App\Models\User;
use App\Support\EntryVersioning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VersioningTest extends TestCase
{
    use RefreshDatabase;

    private function cipher(string $seed = 'x'): string
    {
        return 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode($seed.random_bytes(16));
    }

    private function payload(string $title): array
    {
        return [
            'type' => 1,
            'title' => $title,
            'username' => null,
            'password' => null,
            'url' => null,
            'notes' => null,
            'favorite' => false,
            'custom_fields' => [],
            'tag_ids' => [],
        ];
    }

    public function test_editar_crea_versiones_con_el_estado_anterior(): void
    {
        $user = User::factory()->create();
        $t1 = $this->cipher('t1');
        $entry = $user->entries()->create(['type' => 1, 'title' => $t1]);

        $t2 = $this->cipher('t2');
        $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->payload($t2))->assertOk();
        $t3 = $this->cipher('t3');
        $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->payload($t3))->assertOk();

        // Dos ediciones → dos versiones con los títulos previos (t1, t2).
        $versions = $this->actingAs($user)->getJson("/api/entries/{$entry->id}/versions")
            ->assertOk()->json('versions');
        $this->assertCount(2, $versions);

        // La versión 1 contiene el ciphertext original.
        $v1 = $entry->versions()->where('version', 1)->first();
        $this->assertSame($t1, $v1->title);
    }

    public function test_patch_de_favorito_no_versiona(): void
    {
        $user = User::factory()->create();
        $entry = $user->entries()->create(['type' => 1, 'title' => $this->cipher()]);

        $this->actingAs($user)->patchJson("/api/entries/{$entry->id}", ['favorite' => true])->assertOk();

        $this->assertSame(0, $entry->versions()->count());
    }

    public function test_show_de_version_devuelve_el_snapshot(): void
    {
        $user = User::factory()->create();
        $original = $this->cipher('orig');
        $entry = $user->entries()->create(['type' => 1, 'title' => $original]);

        $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->payload($this->cipher('nuevo')));
        $versionId = $entry->versions()->where('version', 1)->value('id');

        $this->actingAs($user)->getJson("/api/entries/{$entry->id}/versions/{$versionId}")
            ->assertOk()
            ->assertJsonPath('title', $original);
    }

    public function test_restaurar_version_revierte_y_versiona_el_actual(): void
    {
        $user = User::factory()->create();
        $t1 = $this->cipher('t1');
        $entry = $user->entries()->create(['type' => 1, 'title' => $t1]);

        $t2 = $this->cipher('t2');
        $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->payload($t2))->assertOk();
        $versionId = $entry->versions()->where('version', 1)->value('id'); // contiene t1

        $this->actingAs($user)->postJson("/api/entries/{$entry->id}/versions/{$versionId}/restore")
            ->assertOk()
            ->assertJsonPath('data.title', $t1);

        // La entrada volvió a t1 y hay 2 versiones (t1 original + t2 versionado al restaurar).
        $this->assertSame($t1, $entry->fresh()->title);
        $this->assertSame(2, $entry->versions()->count());
    }

    public function test_poda_a_un_maximo_de_versiones(): void
    {
        $user = User::factory()->create();
        $entry = $user->entries()->create(['type' => 1, 'title' => $this->cipher()]);

        for ($i = 0; $i < EntryVersioning::MAX_VERSIONS + 3; $i++) {
            $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->payload($this->cipher("v{$i}")));
        }

        $this->assertSame(EntryVersioning::MAX_VERSIONS, $entry->versions()->count());
        // Las más viejas se podaron: la versión mínima ya no es 1.
        $this->assertGreaterThan(1, $entry->versions()->min('version'));
    }

    public function test_papelera_listar_restaurar_y_purgar(): void
    {
        $user = User::factory()->create();
        $entry = $user->entries()->create(['type' => 1, 'title' => $this->cipher()]);

        // Borrar → papelera
        $this->actingAs($user)->deleteJson("/api/entries/{$entry->id}")->assertNoContent();
        $this->actingAs($user)->getJson('/api/trash')->assertOk()->assertJsonCount(1, 'entries');

        // Restaurar → vuelve a la bóveda
        $this->actingAs($user)->postJson("/api/entries/{$entry->id}/restore")->assertOk();
        $this->actingAs($user)->getJson('/api/trash')->assertJsonCount(0, 'entries');
        $this->actingAs($user)->getJson('/api/vault')->assertJsonCount(1, 'entries');

        // Borrar y purgar definitivamente
        $this->actingAs($user)->deleteJson("/api/entries/{$entry->id}");
        $this->actingAs($user)->deleteJson("/api/entries/{$entry->id}/force")->assertNoContent();
        $this->assertDatabaseMissing('entries', ['id' => $entry->id]);
    }

    public function test_no_se_puede_ver_la_papelera_de_otro_usuario(): void
    {
        $other = User::factory()->create();
        $foreign = $other->entries()->create(['type' => 1, 'title' => $this->cipher()]);
        $foreign->delete();

        $user = User::factory()->create();
        $this->actingAs($user)->postJson("/api/entries/{$foreign->id}/restore")->assertNotFound();
    }
}
