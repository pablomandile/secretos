<?php

namespace Tests\Feature;

use Tests\TestCase;

class TestReportTest extends TestCase
{
    public function test_el_tablero_renderiza_en_local(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->get('/test-report')
            ->assertOk()
            ->assertSee('Tablero de tests');
    }

    public function test_el_tablero_no_existe_fuera_de_local(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->get('/test-report')->assertNotFound();
    }
}
