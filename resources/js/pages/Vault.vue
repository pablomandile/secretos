<script setup lang="ts">
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';

import { useAuthStore } from '@/stores/auth';
import { useKeychainStore } from '@/stores/keychain';

// Placeholder de la Fase 2. La bóveda completa (entradas, carpetas, etc.) llega en la Fase 4.
const auth = useAuthStore();
const keychain = useKeychainStore();
const router = useRouter();

async function lock(): Promise<void> {
    keychain.lock();
    await router.push({ name: 'unlock' });
}

async function logout(): Promise<void> {
    await auth.logout();
    await router.push({ name: 'login' });
}
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950">
        <Card class="w-full max-w-lg">
            <template #title>
                <span class="flex items-center gap-2">
                    <i class="pi pi-unlock text-green-500" />
                    Bóveda desbloqueada
                </span>
            </template>
            <template #content>
                <p class="mb-4 text-surface-600 dark:text-surface-300">
                    Sesión iniciada como <strong>{{ auth.user?.email }}</strong>. La clave de la bóveda está en
                    memoria. (Las entradas se implementan en la Fase 4.)
                </p>
                <div class="flex gap-2">
                    <Button label="Bloquear" icon="pi pi-lock" severity="secondary" @click="lock" />
                    <Button label="Cerrar sesión" icon="pi pi-sign-out" severity="danger" outlined @click="logout" />
                </div>
            </template>
        </Card>
    </div>
</template>
