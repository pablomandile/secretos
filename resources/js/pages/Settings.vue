<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Password from 'primevue/password';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';

import { useAuthStore } from '@/stores/auth';
import StrengthMeter from '@/components/generator/StrengthMeter.vue';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

// --- Cambio de clave maestra ---
const current = ref('');
const next = ref('');
const confirm = ref('');
const score = ref(0);
const changing = ref(false);
const error = ref('');

const canChange = computed(
    () => current.value && next.value.length > 0 && next.value === confirm.value && score.value >= 3,
);

async function changePassword(): Promise<void> {
    if (!canChange.value) return;
    error.value = '';
    changing.value = true;
    try {
        await auth.changeMasterPassword(current.value, next.value);
        current.value = next.value = confirm.value = '';
        toast.add({ severity: 'success', summary: 'Clave maestra actualizada', detail: 'Las otras sesiones se cerraron.', life: 3000 });
    } catch (e) {
        error.value =
            e instanceof AxiosError && e.response?.status === 422
                ? 'La contraseña actual es incorrecta.'
                : 'La contraseña maestra actual es incorrecta.';
    } finally {
        changing.value = false;
    }
}

// --- Auto-bloqueo ---
const autoLock = ref(auth.user?.auto_lock_minutes ?? 5);
const savingPref = ref(false);

async function saveAutoLock(): Promise<void> {
    savingPref.value = true;
    try {
        await auth.updateAutoLock(autoLock.value);
        toast.add({ severity: 'success', summary: 'Preferencia guardada', life: 2000 });
    } finally {
        savingPref.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-screen flex-col bg-surface-50 dark:bg-surface-950">
        <header class="flex items-center gap-3 border-b border-surface-200 px-4 py-2 dark:border-surface-700">
            <Button icon="pi pi-arrow-left" text rounded @click="router.push({ name: 'vault' })" />
            <span class="flex items-center gap-2 font-semibold"><i class="pi pi-cog" /> Ajustes</span>
        </header>

        <main class="mx-auto w-full max-w-xl space-y-6 p-4">
            <Card>
                <template #title>Cambiar clave maestra</template>
                <template #content>
                    <form class="flex flex-col gap-4" @submit.prevent="changePassword">
                        <Message severity="warn" :closable="false">
                            No se puede recuperar. Si la olvidás, perdés el acceso a la bóveda.
                        </Message>
                        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium">Contraseña actual</label>
                            <Password v-model="current" :feedback="false" toggle-mask input-class="w-full" class="w-full" />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium">Nueva contraseña</label>
                            <Password v-model="next" :feedback="false" toggle-mask input-class="w-full" class="w-full" />
                            <StrengthMeter :password="next" @score="score = $event" />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium">Repetir nueva contraseña</label>
                            <Password v-model="confirm" :feedback="false" toggle-mask input-class="w-full" class="w-full" />
                            <small v-if="confirm && confirm !== next" class="text-red-500">No coinciden.</small>
                        </div>
                        <Button type="submit" label="Cambiar clave maestra" icon="pi pi-key" :loading="changing" :disabled="!canChange" />
                    </form>
                </template>
            </Card>

            <Card>
                <template #title>Auto-bloqueo</template>
                <template #content>
                    <div class="flex items-end gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium">Bloquear tras (minutos de inactividad)</label>
                            <InputNumber v-model="autoLock" :min="1" :max="120" show-buttons class="w-40" />
                        </div>
                        <Button label="Guardar" icon="pi pi-check" :loading="savingPref" @click="saveAutoLock" />
                    </div>
                </template>
            </Card>
        </main>
    </div>
</template>
