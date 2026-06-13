<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->nullable();
            $table->string('email')->unique();

            // Identidad de Google (Socialite). La autenticación por Google NO da la
            // clave maestra: el desbloqueo de la bóveda sigue siendo con la clave maestra.
            $table->string('google_id')->nullable()->unique();

            // Hash server-side del *verifier* (derivado en el navegador). NUNCA la clave maestra.
            // Nullable: un usuario nuevo vía Google aún no configuró su clave maestra.
            $table->string('password')->nullable();

            // Parámetros KDF públicos: el cliente los necesita para re-derivar al loguear.
            $table->unsignedTinyInteger('kdf_type')->default(1); // 1 = argon2id
            $table->unsignedInteger('kdf_memory')->default(65536); // KiB
            $table->unsignedSmallInteger('kdf_iterations')->default(3);
            $table->unsignedTinyInteger('kdf_parallelism')->default(4);
            $table->char('kdf_salt', 24)->nullable(); // base64 de 16 bytes, generado en el cliente

            // vaultKey envuelta (ciphertext "v1.iv.ct"). El servidor no puede abrirla.
            // Nullable hasta que se completa el setup de la clave maestra.
            $table->text('protected_key')->nullable();
            $table->unsignedTinyInteger('key_version')->default(1);

            // Preferencia en texto plano.
            $table->unsignedSmallInteger('auto_lock_minutes')->default(5);

            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('sessions');
    }
};
