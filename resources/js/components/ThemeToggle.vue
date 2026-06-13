<script setup lang="ts">
import Button from 'primevue/button';
import { isDark, toggleDark } from '@/services/theme';
</script>

<template>
    <Button
        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
        severity="secondary"
        text
        rounded
        v-tooltip.bottom="isDark ? 'Tema claro' : 'Tema oscuro'"
        @click="toggleDark()"
    />
</template>
