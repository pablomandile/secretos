<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Message from 'primevue/message';

import { useAuthStore } from '@/stores/auth';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const router = useRouter();

const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit(): Promise<void> {
    error.value = '';
    loading.value = true;
    try {
        await auth.unlock(password.value);
        password.value = '';
        await router.push({ name: 'vault' });
    } catch {
        // Fallo del tag GCM = contraseña incorrecta (validación 100% local).
        error.value = 'Contraseña maestra incorrecta.';
    } finally {
        loading.value = false;
    }
}

async function logout(): Promise<void> {
    await auth.logout();
    await router.push({ name: 'login' });
}
</script>

<template>
    <div class="relative flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950">
        <div class="absolute right-4 top-4"><ThemeToggle /></div>
        <Card class="w-full max-w-md">
            <template #title>
                <span class="flex items-center gap-2">
                    <i class="pi pi-lock text-primary" />
                    Bóveda bloqueada
                </span>
            </template>
            <template #subtitle>
                <span v-if="auth.user">{{ auth.user.email }}</span>
            </template>
            <template #content>
                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

                    <div class="flex flex-col gap-2">
                        <label for="password" class="font-medium">Contraseña maestra</label>
                        <Password
                            id="password"
                            v-model="password"
                            :feedback="false"
                            toggle-mask
                            input-class="w-full"
                            class="w-full"
                            autocomplete="current-password"
                            required
                            autofocus
                        />
                    </div>

                    <Button type="submit" label="Desbloquear" icon="pi pi-unlock" :loading="loading" />

                    <Button label="Cerrar sesión" link size="small" @click="logout" />
                </form>
            </template>
        </Card>
    </div>
</template>
