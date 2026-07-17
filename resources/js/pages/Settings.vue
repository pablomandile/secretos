<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Password from 'primevue/password';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';

import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { parseKeepassCsv, parseKeepassXml, type ImportRow } from '@/services/keepassImport';
import { downloadKeepassXml } from '@/services/keepassExport';
import StrengthMeter from '@/components/generator/StrengthMeter.vue';

const auth = useAuthStore();
const vault = useVaultStore();
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

// --- Importar desde KeePass (CSV) ---
const fileInput = ref<HTMLInputElement>();
const rows = ref<ImportRow[]>([]);
const fileName = ref('');
const importing = ref(false);
const progress = ref(0);
const importResult = ref<{ created: number; failed: number } | null>(null);

function pickFile(): void {
    fileInput.value?.click();
}

async function onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName.value = file.name;
    importResult.value = null;
    const text = await file.text();
    const isXml = file.name.toLowerCase().endsWith('.xml') || text.trimStart().startsWith('<?xml') || text.includes('<KeePassFile');
    try {
        rows.value = isXml ? parseKeepassXml(text) : parseKeepassCsv(text);
    } catch {
        rows.value = [];
        toast.add({ severity: 'error', summary: 'No se pudo leer el archivo', detail: 'Formato no reconocido.', life: 4000 });
        return;
    }
    if (!rows.value.length) {
        toast.add({ severity: 'warn', summary: 'No se detectaron entradas', detail: 'Revisá que sea un CSV o XML de KeePass.', life: 4000 });
    }
}

async function runImport(): Promise<void> {
    if (!rows.value.length) return;
    importing.value = true;
    progress.value = 0;
    importResult.value = null;
    try {
        const result = await vault.importRows(rows.value, (done, total) => {
            progress.value = Math.round((done / total) * 100);
        });
        importResult.value = result;
        rows.value = [];
        fileName.value = '';
    } finally {
        importing.value = false;
    }
}

// --- Exportar a KeePass 2 XML (texto plano, generado en el cliente) ---
const exporting = ref(false);

async function runExport(): Promise<void> {
    exporting.value = true;
    try {
        if (!vault.loaded) await vault.load();
        if (!vault.entries.length) {
            toast.add({ severity: 'warn', summary: 'No hay entradas para exportar', life: 3000 });
            return;
        }
        downloadKeepassXml(vault.entries, vault.folders);
        toast.add({
            severity: 'success',
            summary: 'Exportación lista',
            detail: `${vault.entries.length} entradas descargadas en XML.`,
            life: 3000,
        });
    } finally {
        exporting.value = false;
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

            <Card>
                <template #title>Importar desde KeePass (CSV o XML)</template>
                <template #content>
                    <div class="flex flex-col gap-3">
                        <p class="text-sm text-surface-600 dark:text-surface-300">
                            En KeePass 2.x: <strong>Archivo → Exportar → KeePass XML (2.x)</strong> (conserva
                            carpetas, TOTP y campos personalizados) o <strong>CSV</strong>. Elegí el archivo acá;
                            cada entrada se cifra en tu navegador antes de subir.
                        </p>
                        <input ref="fileInput" type="file" accept=".csv,.xml,text/csv,text/xml,application/xml" class="hidden" @change="onFile" />
                        <div class="flex flex-wrap items-center gap-3">
                            <Button label="Elegir archivo CSV" icon="pi pi-upload" outlined @click="pickFile" />
                            <span v-if="fileName" class="text-sm text-surface-600 dark:text-surface-300">
                                {{ fileName }} — {{ rows.length }} entradas detectadas
                            </span>
                        </div>
                        <template v-if="rows.length">
                            <Button :label="`Importar ${rows.length} entradas`" icon="pi pi-check" :loading="importing" @click="runImport" />
                            <ProgressBar v-if="importing" :value="progress" />
                        </template>
                        <Message v-if="importResult" severity="success" :closable="false">
                            Importadas {{ importResult.created }}<span v-if="importResult.failed">, {{ importResult.failed }} fallidas</span>.
                        </Message>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>Exportar (KeePass 2 XML)</template>
                <template #content>
                    <div class="flex flex-col gap-3">
                        <Message severity="warn" :closable="false">
                            El archivo se genera <strong>sin cifrar</strong> (texto plano): cualquiera que lo
                            abra ve todas tus contraseñas. Guardalo en un lugar seguro y borralo cuando termines
                            de reimportarlo.
                        </Message>
                        <p class="text-sm text-surface-600 dark:text-surface-300">
                            Descarga toda la bóveda como <strong>KeePass XML (2.x)</strong> (conserva carpetas,
                            TOTP y campos personalizados). En KeePass 2.x: <strong>Archivo → Importar → KeePass
                            XML (2.x)</strong>. El descifrado y la generación ocurren en tu navegador.
                        </p>
                        <Button
                            label="Exportar bóveda a XML"
                            icon="pi pi-download"
                            :loading="exporting"
                            class="self-start"
                            @click="runExport"
                        />
                    </div>
                </template>
            </Card>
        </main>
    </div>
</template>
