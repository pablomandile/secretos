<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';

import { useAuthStore } from '@/stores/auth';
import StrengthMeter from '@/components/generator/StrengthMeter.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const name = ref('');
const password = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref('');
const score = ref(0);

const passwordsMatch = computed(() => password.value.length > 0 && password.value === confirm.value);
const canSubmit = computed(() => email.value && passwordsMatch.value && score.value >= 3);

async function submit(): Promise<void> {
    if (!canSubmit.value) return;
    error.value = '';
    loading.value = true;
    try {
        await auth.register(email.value.trim(), password.value, name.value.trim() || null);
        password.value = '';
        confirm.value = '';
        await router.push({ name: 'vault' });
    } catch (e) {
        error.value =
            e instanceof AxiosError && e.response?.status === 422
                ? 'Ese email ya está registrado o los datos son inválidos.'
                : 'No se pudo crear la cuenta. Intentá de nuevo.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="relative flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950">
        <div class="absolute right-4 top-4"><ThemeToggle /></div>
        <Card class="w-full max-w-md">
            <template #title>
                <span class="flex items-center gap-2">
                    <i class="pi pi-lock text-primary" />
                    Crear bóveda
                </span>
            </template>
            <template #content>
                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

                    <Message severity="warn" :closable="false">
                        Tu contraseña maestra cifra todo y <strong>no se puede recuperar</strong>. Si la olvidás,
                        perdés el acceso a la bóveda. Guardala en un lugar seguro.
                    </Message>

                    <div class="flex flex-col gap-2">
                        <label for="email" class="font-medium">Email</label>
                        <InputText id="email" v-model="email" type="email" autocomplete="username" required autofocus />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="name" class="font-medium">Nombre <span class="text-surface-400">(opcional)</span></label>
                        <InputText id="name" v-model="name" type="text" autocomplete="name" />
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
                            autocomplete="new-password"
                            required
                        />
                        <StrengthMeter :password="password" @score="score = $event" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="confirm" class="font-medium">Repetir contraseña</label>
                        <Password
                            id="confirm"
                            v-model="confirm"
                            :feedback="false"
                            toggle-mask
                            input-class="w-full"
                            class="w-full"
                            autocomplete="new-password"
                            required
                        />
                        <small v-if="confirm && !passwordsMatch" class="text-danger">No coinciden.</small>
                    </div>

                    <Button
                        type="submit"
                        label="Crear bóveda"
                        icon="pi pi-check"
                        :loading="loading"
                        :disabled="!canSubmit"
                    />

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
                        ¿Ya tenés cuenta?
                        <RouterLink :to="{ name: 'login' }" class="text-primary hover:underline">Ingresar</RouterLink>
                    </p>
                </form>
            </template>
        </Card>
    </div>
</template>
