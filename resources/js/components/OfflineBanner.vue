<script setup lang="ts">
import { computed } from 'vue';

import { estaSinConexion, guardadoEn } from '@/services/conexion';

/** "hace 5 min" / "hace 2 h" / "hace 3 días" a partir del ISO guardado. */
const antiguedad = computed(() => {
    if (!guardadoEn.value) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(guardadoEn.value).getTime()) / 60000));
    if (min < 1) return ' (guardado hace instantes)';
    if (min < 60) return ` (guardado hace ${min} min)`;
    const h = Math.round(min / 60);
    if (h < 48) return ` (guardado hace ${h} h)`;
    return ` (guardado hace ${Math.round(h / 24)} días)`;
});
</script>

<template>
    <!-- sticky y no fixed: flotando taparía el encabezado justo cuando se está sin red. -->
    <div
        v-if="estaSinConexion"
        role="status"
        class="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-white"
    >
        <i class="pi pi-wifi" />
        <span>Sin conexión: solo lectura{{ antiguedad }}</span>
    </div>
</template>
