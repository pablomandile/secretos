<?php

namespace Tests\Feature;

use App\Models\Entry;
use App\Models\Folder;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VaultTest extends TestCase
{
    use RefreshDatabase;

    /** Genera un valor con forma de ciphertext "v1.iv.ct" (sin cifrar de verdad). */
    private function cipher(string $seed = 'x'): string
    {
        return 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode($seed.random_bytes(16));
    }

    // Helpers que crean vía relación (user_id no es mass-assignable a propósito).
    private function makeEntry(User $user, array $attrs = []): Entry
    {
        return $user->entries()->create(array_merge(['type' => 1, 'title' => $this->cipher()], $attrs));
    }

    private function makeFolder(User $user, array $attrs = []): Folder
    {
        return $user->folders()->create(array_merge(['name' => $this->cipher()], $attrs));
    }

    private function makeTag(User $user, array $attrs = []): Tag
    {
        return $user->tags()->create(array_merge(['name' => $this->cipher()], $attrs));
    }

    private function entryPayload(array $overrides = []): array
    {
        return array_merge([
            'type' => 1,
            'title' => $this->cipher('title'),
            'username' => $this->cipher('user'),
            'password' => $this->cipher('pass'),
            'url' => $this->cipher('url'),
            'notes' => null,
            'favorite' => false,
            'custom_fields' => [],
            'tag_ids' => [],
        ], $overrides);
    }

    public function test_vault_index_devuelve_los_datos_del_usuario(): void
    {
        $user = User::factory()->create();
        $folder = $this->makeFolder($user);
        $entry = $this->makeEntry($user, ['folder_id' => $folder->id]);
        $tag = $this->makeTag($user);
        $entry->tags()->attach($tag);

        $this->actingAs($user)->getJson('/api/vault')
            ->assertOk()
            ->assertJsonCount(1, 'folders')
            ->assertJsonCount(1, 'tags')
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.id', $entry->id)
            ->assertJsonPath('entries.0.tag_ids.0', $tag->id);
    }

    public function test_vault_aisla_los_datos_entre_usuarios(): void
    {
        $other = User::factory()->create();
        $this->makeEntry($other);
        $this->makeFolder($other);

        $me = User::factory()->create();

        $this->actingAs($me)->getJson('/api/vault')
            ->assertOk()
            ->assertJsonCount(0, 'folders')
            ->assertJsonCount(0, 'entries');
    }

    public function test_crear_entrada_con_ciphertext_persiste_y_devuelve_el_recurso(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/entries', $this->entryPayload([
            'custom_fields' => [
                ['label' => $this->cipher('l'), 'value' => $this->cipher('v'), 'type' => 2, 'protected' => true, 'position' => 0],
            ],
        ]))->assertCreated();

        $id = $response->json('data.id');
        $this->assertDatabaseHas('entries', ['id' => $id, 'user_id' => $user->id]);
        $this->assertDatabaseCount('custom_fields', 1);
        $response->assertJsonPath('data.custom_fields.0.protected', true);
    }

    public function test_acepta_campo_personalizado_totp_type_3(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/entries', $this->entryPayload([
            'custom_fields' => [
                ['label' => $this->cipher('TOTP'), 'value' => $this->cipher('otpauth'), 'type' => 3, 'protected' => true, 'position' => 0],
            ],
        ]))->assertCreated();

        $response->assertJsonPath('data.custom_fields.0.type', 3);
        $this->assertDatabaseHas('custom_fields', ['type' => 3]);
    }

    public function test_rechaza_titulo_en_texto_plano(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/entries', $this->entryPayload(['title' => 'texto plano sin cifrar']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');
    }

    public function test_no_se_puede_usar_carpeta_de_otro_usuario(): void
    {
        $other = User::factory()->create();
        $foreignFolder = $this->makeFolder($other);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/entries', $this->entryPayload(['folder_id' => $foreignFolder->id]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('folder_id');
    }

    public function test_actualizar_entrada_reemplaza_campos_y_tags(): void
    {
        $user = User::factory()->create();
        $entry = $this->makeEntry($user);
        $tag = $this->makeTag($user);

        $this->actingAs($user)->putJson("/api/entries/{$entry->id}", $this->entryPayload([
            'tag_ids' => [$tag->id],
            'custom_fields' => [
                ['label' => $this->cipher(), 'value' => $this->cipher(), 'type' => 1, 'position' => 0],
            ],
        ]))->assertOk()->assertJsonPath('data.tag_ids.0', $tag->id);

        $this->assertDatabaseCount('custom_fields', 1);
    }

    public function test_no_se_puede_actualizar_entrada_de_otro_usuario(): void
    {
        $other = User::factory()->create();
        $foreign = $this->makeEntry($other);

        $user = User::factory()->create();

        $this->actingAs($user)->putJson("/api/entries/{$foreign->id}", $this->entryPayload())
            ->assertNotFound();
    }

    public function test_patch_metadata_cambia_favorito_sin_tocar_secretos(): void
    {
        $user = User::factory()->create();
        $entry = $this->makeEntry($user, ['favorite' => false]);

        $this->actingAs($user)->patchJson("/api/entries/{$entry->id}", ['favorite' => true])
            ->assertOk()
            ->assertJsonPath('data.favorite', true);

        $this->assertDatabaseHas('entries', ['id' => $entry->id, 'favorite' => true]);
    }

    public function test_borrar_entrada_la_manda_a_la_papelera(): void
    {
        $user = User::factory()->create();
        $entry = $this->makeEntry($user);

        $this->actingAs($user)->deleteJson("/api/entries/{$entry->id}")->assertNoContent();

        $this->assertSoftDeleted('entries', ['id' => $entry->id]);
        $this->actingAs($user)->getJson('/api/vault')->assertJsonCount(0, 'entries');
    }

    public function test_crud_de_carpetas_y_etiquetas(): void
    {
        $user = User::factory()->create();

        $folderId = $this->actingAs($user)->postJson('/api/folders', ['name' => $this->cipher()])
            ->assertCreated()->json('data.id');
        $this->actingAs($user)->putJson("/api/folders/{$folderId}", ['name' => $this->cipher('nuevo')])->assertOk();

        $tagId = $this->actingAs($user)->postJson('/api/tags', ['name' => $this->cipher(), 'color' => '#ff8800'])
            ->assertCreated()->json('data.id');

        $this->actingAs($user)->deleteJson("/api/tags/{$tagId}")->assertNoContent();
        $this->assertDatabaseMissing('tags', ['id' => $tagId]);
        $this->assertDatabaseHas('folders', ['id' => $folderId]);
    }

    public function test_requiere_autenticacion(): void
    {
        $this->getJson('/api/vault')->assertUnauthorized();
        $this->postJson('/api/entries', $this->entryPayload())->assertUnauthorized();
    }
}
