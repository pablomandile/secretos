<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entry_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('entry_id')->constrained('entries')->cascadeOnDelete();
            $table->unsignedInteger('version');

            // Snapshot de las columnas ciphertext (el servidor versiona sin leer nada).
            $table->text('title');
            $table->text('username')->nullable();
            $table->text('password')->nullable();
            $table->text('url')->nullable();
            $table->mediumText('notes')->nullable();
            $table->ulid('folder_id')->nullable();
            // [{label, value, type, protected, position}] — valores ciphertext, estructura plana.
            $table->json('custom_fields')->nullable();

            $table->timestamp('created_at')->nullable();

            $table->unique(['entry_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entry_versions');
    }
};
