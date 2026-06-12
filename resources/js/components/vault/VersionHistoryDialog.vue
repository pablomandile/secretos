<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Timeline from 'primevue/timeline';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';

import { useVaultStore } from '@/stores/vault';

const props = defineProps<{ visible: boolean; entryId: string | null }>();
const emit = defineEmits<{ 'update:visible': [value: boolean] }>();

const vault = useVaultStore();
const toast = useToast();

interface VersionMeta {
    id: number;
    version: number;
    createdAt: string;
}

const versions = ref<VersionMeta[]>([]);
const loading = ref(false);
const detail = ref<Awaited<ReturnType<typeof vault.fetchVersionDetail>> | null>(null);
const restoring = ref(false);

watch(
    () => props.visible,
    async (open) => {
        if (!open || !props.entryId) return;
        detail.value = null;
        loading.value = true;
        try {
            versions.value = await vault.fetchVersions(props.entryId);
        } finally {
            loading.value = false;
        }
    },
);

async function viewDetail(versionId: number): Promise<void> {
    if (!props.entryId) return;
    detail.value = await vault.fetchVersionDetail(props.entryId, versionId);
}

async function restore(versionId: number): Promise<void> {
    if (!props.entryId) return;
    restoring.value = true;
    try {
        await vault.restoreVersion(props.entryId, versionId);
        toast.add({ severity: 'success', summary: 'Versión restaurada', life: 2000 });
        emit('update:visible', false);
    } finally {
        restoring.value = false;
    }
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}
</script>

<template>
    <Dialog
        :visible="props.visible"
        modal
        header="Historial de versiones"
        class="w-full max-w-3xl"
        @update:visible="emit('update:visible', $event)"
    >
        <div v-if="loading" class="flex justify-center py-8"><ProgressSpinner /></div>

        <div v-else-if="!versions.length" class="py-8 text-center text-surface-500">
            Esta entrada todavía no tiene historial. Se crea una versión cada vez que la editás.
        </div>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Timeline :value="versions" class="max-h-96 overflow-y-auto">
                <template #content="{ item }">
                    <div class="mb-3 flex items-center justify-between gap-2 rounded-md border border-surface-200 p-2 dark:border-surface-700">
                        <div class="flex flex-col">
                            <span class="font-medium">Versión {{ item.version }}</span>
                            <span class="text-xs text-surface-500">{{ formatDate(item.createdAt) }}</span>
                        </div>
                        <div class="flex gap-1">
                            <Button icon="pi pi-eye" text rounded size="small" v-tooltip.top="'Ver'" @click="viewDetail(item.id)" />
                            <Button
                                icon="pi pi-undo"
                                text
                                rounded
                                size="small"
                                v-tooltip.top="'Restaurar'"
                                :loading="restoring"
                                @click="restore(item.id)"
                            />
                        </div>
                    </div>
                </template>
            </Timeline>

            <!-- Detalle de la versión seleccionada -->
            <div v-if="detail" class="flex flex-col gap-2 rounded-md bg-surface-100 p-3 text-sm dark:bg-surface-800">
                <div><span class="text-surface-500">Título:</span> {{ detail.title }}</div>
                <div v-if="detail.username"><span class="text-surface-500">Usuario:</span> {{ detail.username }}</div>
                <div v-if="detail.password"><span class="text-surface-500">Contraseña:</span> <span class="font-mono">{{ detail.password }}</span></div>
                <div v-if="detail.url"><span class="text-surface-500">URL:</span> {{ detail.url }}</div>
                <div v-if="detail.notes" class="whitespace-pre-wrap"><span class="text-surface-500">Notas:</span> {{ detail.notes }}</div>
                <div v-for="(f, i) in detail.customFields" :key="i">
                    <span class="text-surface-500">{{ f.label }}:</span> {{ f.value }}
                </div>
            </div>
            <div v-else class="flex items-center justify-center text-sm text-surface-400">
                Elegí una versión para ver su contenido.
            </div>
        </div>
    </Dialog>
</template>
