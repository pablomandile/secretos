<?php

namespace Tests\Feature;

use Tests\TestCase;

class AboutPageTest extends TestCase
{
    public function test_acerca_de_sirve_el_shell_de_la_spa_sin_sesion(): void
    {
        // La página es pública: la ruta comodín devuelve el shell y Vue Router
        // resuelve /acerca-de en el cliente, con o sin sesión.
        $this->get('/acerca-de')
            ->assertOk()
            ->assertSee('id="app"', escape: false);
    }
}
