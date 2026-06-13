<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://localhost:8000');
    }

    private function fakeGoogleUser(string $id, string $email, ?string $name = 'Usuario'): void
    {
        $googleUser = Mockery::mock(SocialiteUser::class);
        $googleUser->shouldReceive('getId')->andReturn($id);
        $googleUser->shouldReceive('getEmail')->andReturn($email);
        $googleUser->shouldReceive('getName')->andReturn($name);

        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('user')->andReturn($googleUser);

        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
    }

    public function test_redirect_envia_a_google(): void
    {
        config(['services.google.client_id' => 'dummy', 'services.google.client_secret' => 'dummy']);

        $this->get('/auth/google/redirect')
            ->assertRedirectContains('accounts.google.com');
    }

    public function test_callback_crea_un_usuario_nuevo_y_lo_autentica(): void
    {
        $this->fakeGoogleUser('google-123', 'nuevo@example.com', 'Nuevo');

        $this->get('/auth/google/callback')->assertRedirect('/app');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'nuevo@example.com',
            'google_id' => 'google-123',
        ]);
        // Cuenta nueva: sin bóveda configurada todavía.
        $user = User::where('email', 'nuevo@example.com')->first();
        $this->assertNull($user->protected_key);
    }

    public function test_callback_vincula_una_cuenta_existente_por_email(): void
    {
        $user = User::factory()->create(['email' => 'pablo@example.com', 'google_id' => null]);

        $this->fakeGoogleUser('google-999', 'pablo@example.com');

        $this->get('/auth/google/callback')->assertRedirect('/app');

        $this->assertSame(1, User::where('email', 'pablo@example.com')->count());
        $this->assertSame('google-999', $user->fresh()->google_id);
    }

    public function test_setup_key_configura_la_boveda_de_una_cuenta_sin_clave(): void
    {
        $user = User::factory()->create([
            'password' => null,
            'kdf_salt' => null,
            'protected_key' => null,
        ]);

        $payload = [
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => base64_encode(random_bytes(16)),
            'verifier' => base64_encode(random_bytes(32)),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
        ];

        $this->actingAs($user)->postJson('/api/auth/setup-key', $payload)
            ->assertOk()
            ->assertJsonPath('protected_key', $payload['protected_key']);

        $this->assertSame($payload['protected_key'], $user->fresh()->protected_key);
    }

    public function test_setup_key_rechaza_si_la_boveda_ya_existe(): void
    {
        $user = User::factory()->create(); // factory ya pone protected_key

        $this->actingAs($user)->postJson('/api/auth/setup-key', [
            'kdf_type' => 1,
            'kdf_memory' => 65536,
            'kdf_iterations' => 3,
            'kdf_parallelism' => 4,
            'kdf_salt' => base64_encode(random_bytes(16)),
            'verifier' => base64_encode(random_bytes(32)),
            'protected_key' => 'v1.'.base64_encode(random_bytes(12)).'.'.base64_encode(random_bytes(48)),
        ])->assertStatus(409);
    }
}
