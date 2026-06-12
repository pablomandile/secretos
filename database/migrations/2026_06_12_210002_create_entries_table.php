<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entries', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('folder_id')->nullable()->constrained('folders')->nullOnDelete();

            // 1=login (reservados: 2=nota segura, 3=tarjeta).
            $table->unsignedTinyInteger('type')->default(1);

            // Todos los campos sensibles son ciphertext "v1.iv.ct".
            $table->text('title');
            $table->text('username')->nullable();
            $table->text('password')->nullable();
            $table->text('url')->nullable();
            $table->mediumText('notes')->nullable();

            // Metadata en texto plano (fuga aceptada, igual que Bitwarden).
            $table->boolean('favorite')->default(false);

            $table->timestamps();
            $table->softDeletes(); // deleted_at = papelera de reciclaje

            $table->index(['user_id', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entries');
    }
};
