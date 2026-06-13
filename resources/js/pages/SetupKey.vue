<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Message from 'primevue/message';

import { useAuthStore } from '@/stores/auth';
import StrengthMeter from '@/components/generator/StrengthMeter.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const router = useRouter();

const password = ref('');
const confirm = ref('');
const score = ref(0);
const loading = ref(false);
const error = ref('');

const passwordsMatch = computed(() => password.value.length > 0 && password.value === confirm.value);
const canSubmit = computed(() => passwordsMatch.value && score.value >= 3);

async function submit(): Promise<void> {
    if (!canSubmit.value) return;
    error.value = '';
    loading.value = true;
    try {
        await auth.setupKey(password.value);
        password.value = '';
        confirm.value = '';
        await router.push({ name: 'vault' });
    } catch {
        error.value = 'No se pudo configurar la clave maestra. Intentá de nuevo.';
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
                    <i class="pi pi-key text-primary" />
                    Configurá tu clave maestra
                </span>
            </template>
            <template #subtitle>
                <span v-if="auth.user">{{ auth.user.email }}</span>
            </template>
            <template #content>
                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <Message severity="info" :closable="false">
                        Entraste con Google. Ahora elegí una <strong>clave maestra</strong>: es la que cifra tu bóveda
                        y la vas a necesitar para desbloquearla. Google no puede verla ni recuperarla.
                    </Message>
                    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

                    <div class="flex flex-col gap-1">
                        <label class="font-medium">Clave maestra</label>
                        <Password
                            v-model="password"
                            :feedback="false"
                            toggle-mask
                            input-class="w-full"
                            class="w-full"
                            autocomplete="new-password"
                            autofocus
                        />
                        <StrengthMeter :password="password" @score="score = $event" />
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="font-medium">Repetir clave maestra</label>
                        <Password
                            v-model="confirm"
                            :feedback="false"
                            toggle-mask
                            input-class="w-full"
                            class="w-full"
                            autocomplete="new-password"
                        />
                        <small v-if="confirm && !passwordsMatch" class="text-red-500">No coinciden.</small>
                    </div>

                    <Button type="submit" label="Crear bóveda" icon="pi pi-check" :loading="loading" :disabled="!canSubmit" />
                    <Button label="Cerrar sesión" link size="small" @click="logout" />
                </form>
            </template>
        </Card>
    </div>
</template>
