<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://localhost:8000');
    }

    private function masterPasswordPayload(array $overrides = []): array
    {
        return array_merge([
            'current_verifier' => base64_encode(random_bytes(32)),
            'verifier' => base64_encode(random_bytes(32)),
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => base64_encode(random_bytes(16)),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
        ], $overrides);
    }

    public function test_cambia_la_clave_maestra_con_el_verifier_actual_correcto(): void
    {
        $currentVerifier = base64_encode(random_bytes(32));
        $user = User::factory()->create(['password' => Hash::make($currentVerifier)]);

        $payload = $this->masterPasswordPayload(['current_verifier' => $currentVerifier]);

        $this->actingAs($user)->putJson('/api/account/master-password', $payload)->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check($payload['verifier'], $user->password));
        $this->assertSame($payload['kdf_salt'], $user->kdf_salt);
        $this->assertSame($payload['protected_key'], $user->protected_key);
    }

    public function test_rechaza_el_cambio_con_verifier_actual_incorrecto(): void
    {
        $user = User::factory()->create(['password' => Hash::make(base64_encode(random_bytes(32)))]);

        $this->actingAs($user)
            ->putJson('/api/account/master-password', $this->masterPasswordPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('current_verifier');
    }

    public function test_el_cambio_cierra_las_otras_sesiones(): void
    {
        $currentVerifier = base64_encode(random_bytes(32));
        $user = User::factory()->create(['password' => Hash::make($currentVerifier)]);

        // Sesión de "otro dispositivo".
        DB::table('sessions')->insert([
            'id' => 'otra-sesion',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => 'x',
            'last_activity' => time(),
        ]);

        $this->actingAs($user)
            ->putJson('/api/account/master-password', $this->masterPasswordPayload(['current_verifier' => $currentVerifier]))
            ->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'otra-sesion']);
    }

    public function test_actualiza_la_preferencia_de_auto_bloqueo(): void
    {
        $user = User::factory()->create(['auto_lock_minutes' => 5]);

        $this->actingAs($user)->patchJson('/api/account/preferences', ['auto_lock_minutes' => 15])
            ->assertOk()
            ->assertJsonPath('auto_lock_minutes', 15);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'auto_lock_minutes' => 15]);
    }

    public function test_envia_headers_de_seguridad(): void
    {
        $this->get('/login')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'same-origin');
    }

    public function test_export_e_import_son_stubs_501(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/export')->assertStatus(501);
        $this->actingAs($user)->postJson('/api/import')->assertStatus(501);
    }
}
