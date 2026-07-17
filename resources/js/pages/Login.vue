<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';

import { useAuthStore } from '@/stores/auth';
import AppLogo from '@/components/AppLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit(): Promise<void> {
    error.value = '';
    loading.value = true;
    try {
        await auth.login(email.value.trim(), password.value);
        password.value = '';
        await router.push({ name: 'vault' });
    } catch (e) {
        error.value =
            e instanceof AxiosError && e.response?.status === 422
                ? 'Email o contraseña maestra incorrectos.'
                : 'No se pudo iniciar sesión. Intentá de nuevo.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="relative flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950">
        <div class="absolute right-4 top-4"><ThemeToggle /></div>
        <div class="w-full max-w-md">
            <AppLogo class="mx-auto mb-6 w-56" />
            <Card>
            <template #title>Ingresá a tu bóveda</template>
            <template #content>
                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

                    <div class="flex flex-col gap-2">
                        <label for="email" class="font-medium">Email</label>
                        <InputText id="email" v-model="email" type="email" autocomplete="username" required autofocus />
                    </div>

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
                        />
                    </div>

                    <Button type="submit" label="Desbloquear" icon="pi pi-unlock" :loading="loading" />

                    <div class="flex items-center gap-2 text-xs text-surface-400">
                        <span class="h-px flex-1 bg-surface-200 dark:bg-surface-700" /> o
                        <span class="h-px flex-1 bg-surface-200 dark:bg-surface-700" />
                    </div>
                    <Button
                        type="button"
                        label="Continuar con Google"
                        icon="pi pi-google"
                        severity="secondary"
                        outlined
                        @click="auth.loginWithGoogle()"
                    />

                    <p class="text-center text-sm text-surface-500">
                        ¿No tenés cuenta?
                        <RouterLink :to="{ name: 'register' }" class="text-primary hover:underline">
                            Crear una
                        </RouterLink>
                    </p>
                </form>
            </template>
            </Card>
        </div>
    </div>
</template>
