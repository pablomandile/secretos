<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "No mostrar": una carpeta oculta (y sus subcarpetas) no aparece en el
 * listado "Todas". Es solo una preferencia de vista: las claves siguen ahí.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->boolean('hidden')->default(false)->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->dropColumn('hidden');
        });
    }
};
