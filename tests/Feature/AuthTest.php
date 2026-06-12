<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Simula que la request viene del SPA del mismo origen (Sanctum stateful).
        // Debe coincidir con SANCTUM_STATEFUL_DOMAINS (incluye el puerto).
        $this->withHeader('Origin', 'http://localhost:8000');
    }

    private function validRegisterPayload(array $overrides = []): array
    {
        return array_merge([
            'email' => 'pablo@example.com',
            'name' => 'Pablo',
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => base64_encode(random_bytes(16)),
            'verifier' => base64_encode(random_bytes(32)),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
        ], $overrides);
    }

    public function test_prelogin_devuelve_parametros_kdf_de_un_usuario_existente(): void
    {
        $user = User::factory()->create(['email' => 'pablo@example.com', 'kdf_memory' => 131072]);

        $this->postJson('/api/auth/prelogin', ['email' => 'pablo@example.com'])
            ->assertOk()
            ->assertJson([
                'kdf_type' => 1,
                'kdf_memory' => 131072,
                'kdf_salt' => $user->kdf_salt,
            ]);
    }

    public function test_prelogin_devuelve_salt_falso_determinista_para_email_desconocido(): void
    {
        $a = $this->postJson('/api/auth/prelogin', ['email' => 'nadie@example.com'])->assertOk()->json();
        $b = $this->postJson('/api/auth/prelogin', ['email' => 'nadie@example.com'])->assertOk()->json();

        // Mismo salt en cada llamada (determinista) y con forma válida (24 chars).
        $this->assertSame($a['kdf_salt'], $b['kdf_salt']);
        $this->assertSame(24, strlen($a['kdf_salt']));
    }

    public function test_registro_crea_usuario_y_guarda_solo_el_hash_del_verifier(): void
    {
        $payload = $this->validRegisterPayload();

        $this->postJson('/api/auth/register', $payload)
            ->assertCreated()
            ->assertJsonPath('user.email', 'pablo@example.com')
            ->assertJsonPath('protected_key', $payload['protected_key'])
            ->assertJsonMissingPath('user.password');

        $user = User::where('email', 'pablo@example.com')->firstOrFail();

        // El verifier NUNCA se guarda en claro; se guarda su hash y es verificable.
        $this->assertNotSame($payload['verifier'], $user->password);
        $this->assertTrue(Hash::check($payload['verifier'], $user->password));
        $this->assertSame($payload['kdf_salt'], $user->kdf_salt);
    }

    public function test_registro_autentica_la_sesion(): void
    {
        $this->postJson('/api/auth/register', $this->validRegisterPayload());
        $this->assertAuthenticated();
    }

    public function test_registro_valida_parametros_kdf_y_formatos(): void
    {
        $this->postJson('/api/auth/register', $this->validRegisterPayload(['kdf_memory' => 1024]))
            ->assertStatus(422)->assertJsonValidationErrors('kdf_memory');

        $this->postJson('/api/auth/register', $this->validRegisterPayload(['verifier' => 'corto']))
            ->assertStatus(422)->assertJsonValidationErrors('verifier');

        $this->postJson('/api/auth/register', $this->validRegisterPayload(['protected_key' => 'no-cipher']))
            ->assertStatus(422)->assertJsonValidationErrors('protected_key');
    }

    public function test_email_duplicado_es_rechazado(): void
    {
        User::factory()->create(['email' => 'pablo@example.com']);

        $this->postJson('/api/auth/register', $this->validRegisterPayload())
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_login_con_verifier_correcto_devuelve_protected_key(): void
    {
        $verifier = base64_encode(random_bytes(32));
        $user = User::factory()->create([
            'email' => 'pablo@example.com',
            'password' => Hash::make($verifier),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
        ]);

        $this->postJson('/api/auth/login', ['email' => 'pablo@example.com', 'verifier' => $verifier])
            ->assertOk()
            ->assertJsonPath('protected_key', $user->protected_key)
            ->assertJsonPath('kdf.kdf_salt', $user->kdf_salt);

        $this->assertAuthenticated();
    }

    public function test_login_con_verifier_incorrecto_falla(): void
    {
        User::factory()->create([
            'email' => 'pablo@example.com',
            'password' => Hash::make(base64_encode(random_bytes(32))),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'pablo@example.com',
            'verifier' => base64_encode(random_bytes(32)),
        ])->assertStatus(422);

        $this->assertGuest();
    }

    public function test_session_requiere_autenticacion(): void
    {
        $this->getJson('/api/auth/session')->assertUnauthorized();
    }

    public function test_session_devuelve_payload_del_usuario_autenticado(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('protected_key', $user->protected_key);
    }

    public function test_logout_cierra_la_sesion(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/auth/logout')->assertNoContent();
    }
}
