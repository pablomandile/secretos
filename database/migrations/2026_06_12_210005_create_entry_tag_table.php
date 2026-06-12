<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entry_tag', function (Blueprint $table) {
            $table->foreignUlid('entry_id')->constrained('entries')->cascadeOnDelete();
            $table->foreignUlid('tag_id')->constrained('tags')->cascadeOnDelete();
            $table->primary(['entry_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entry_tag');
    }
};
