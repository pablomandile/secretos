<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('entry_id')->constrained('entries')->cascadeOnDelete();
            $table->text('label');  // ciphertext
            $table->text('value');  // ciphertext
            // 1=texto, 2=protegido (reservado: 3=totp).
            $table->unsignedTinyInteger('type')->default(1);
            // Flag de display en texto plano: revela QUE un campo es secreto, no su contenido.
            $table->boolean('protected')->default(false);
            $table->unsignedSmallInteger('position')->default(0);

            $table->index('entry_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_fields');
    }
};
