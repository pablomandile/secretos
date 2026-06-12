<script setup lang="ts">
import Button from 'primevue/button';
import Card from 'primevue/card';
import { useToast } from 'primevue/usetoast';

const toast = useToast();

function probar(): void {
    toast.add({
        severity: 'success',
        summary: 'Secretos',
        detail: 'Laravel + Vue 3 + PrimeVue funcionando',
        life: 3000,
    });
}
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-900">
        <Card class="w-96">
            <template #title>
                <span class="flex items-center gap-2">
                    <i class="pi pi-lock text-primary" />
                    Secretos
                </span>
            </template>
            <template #content>
                <p class="mb-4 text-surface-600 dark:text-surface-300">
                    Gestor de claves personal — bóveda zero-knowledge.
                </p>
                <Button label="Probar PrimeVue" icon="pi pi-check" @click="probar" />
            </template>
        </Card>
    </div>
</template>
