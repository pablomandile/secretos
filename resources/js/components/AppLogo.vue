<script setup lang="ts">
import { computed } from 'vue';
import { isDark } from '@/services/theme';

/**
 * Logo de Secretos. Muestra la versión clara u oscura según el tema activo.
 * El tamaño lo define quien lo usa vía `class` (p. ej. `h-8` o `w-52`).
 */
const src = computed(() => (isDark.value ? '/img/logo-dark.png' : '/img/logo-light.png'));
</script>

<template>
    <img :src="src" alt="Secretos — Tu gestor de claves" draggable="false" />
</template>
