<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://localhost:8000');
    }

    private function boveda(): array
    {
        return json_decode(file_get_contents(database_path('seeders/demo/boveda.json')), true);
    }

    private function demoUser(): ?User
    {
        return User::where('email', config('demo.email'))->first();
    }

    public function test_el_reset_se_niega_si_la_instancia_no_es_la_demo(): void
    {
        config(['demo.enabled' => false]);
        $otro = User::factory()->create();

        $this->artisan('demo:reset')->assertFailed();

        $this->assertNull($this->demoUser());
        $this->assertTrue($otro->fresh()->exists);
    }

    public function test_el_reset_resiembra_la_demo_sin_tocar_las_otras_cuentas(): void
    {
        config(['demo.enabled' => true]);
        $otro = User::factory()->create();
        $otro->entries()->create(['type' => 1, 'title' => 'v1.AAAA.BBBB']);

        $this->artisan('demo:reset')->assertSuccessful();
        $demo = $this->demoUser();
        $total = count($this->boveda()['entries']);
        $this->assertSame($total, $demo->entries()->count());
        $this->assertSame(count($this->boveda()['folders']), $demo->folders()->count());

        // Un visitante agrega algo; el reset siguiente lo borra.
        $demo->entries()->create(['type' => 1, 'title' => 'v1.CCCC.DDDD']);
        $this->artisan('demo:reset')->assertSuccessful();

        $this->assertSame($total, $this->demoUser()->entries()->count());
        $this->assertSame(1, $otro->entries()->count());
    }

    public function test_la_entrada_mas_nueva_de_la_demo_es_reciente(): void
    {
        config(['demo.enabled' => true]);
        $this->artisan('demo:reset')->assertSuccessful();

        $masNueva = $this->demoUser()->entries()->max('created_at');
        $this->assertTrue(now()->subDays(3)->lt($masNueva));
    }

    public function test_se_entra_a_la_demo_con_el_verifier_del_fixture(): void
    {
        config(['demo.enabled' => true]);
        $this->artisan('demo:reset')->assertSuccessful();

        $this->postJson('/api/auth/login', ['email' => config('demo.email'), 'verifier' => $this->boveda()['verifier']])
            ->assertOk()
            ->assertJsonPath('user.demo', true)
            ->assertJsonPath('protected_key', $this->boveda()['protected_key']);
    }

    public function test_la_demo_no_puede_cambiar_la_clave_maestra(): void
    {
        config(['demo.enabled' => true]);
        $this->artisan('demo:reset')->assertSuccessful();
        $demo = $this->demoUser();
        $antes = $demo->protected_key;

        $this->actingAs($demo)
            ->putJson('/api/account/master-password', ['current_verifier' => $this->boveda()['verifier']])
            ->assertForbidden();

        $this->assertSame($antes, $demo->fresh()->protected_key);
    }

    public function test_el_shell_publica_las_credenciales_solo_en_la_demo(): void
    {
        config(['demo.enabled' => false]);
        $this->get('/login')->assertOk()->assertDontSee('name="demo-email"', escape: false);

        config(['demo.enabled' => true]);
        $this->get('/login')->assertOk()
            ->assertSee('<meta name="demo-email" content="'.config('demo.email').'">', escape: false);
    }

    public function test_fuera_de_la_demo_una_cuenta_con_ese_email_es_normal(): void
    {
        config(['demo.enabled' => false]);
        $user = User::factory()->create(['email' => config('demo.email')]);

        $this->assertFalse($user->isDemo());
    }
}
