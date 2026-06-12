<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useConfirm } from 'primevue/useconfirm';

import { useVaultStore, type DecryptedEntry } from '@/stores/vault';

const vault = useVaultStore();
const router = useRouter();
const confirm = useConfirm();
const loading = ref(true);

onMounted(async () => {
    await vault.loadTrash();
    loading.value = false;
});

function purge(entry: DecryptedEntry): void {
    confirm.require({
        message: `"${entry.title}" se eliminará para siempre, sin posibilidad de recuperación.`,
        header: 'Eliminar definitivamente',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Eliminar para siempre',
        acceptClass: 'p-button-danger',
        accept: () => vault.purgeEntry(entry.id),
    });
}
</script>

<template>
    <div class="flex h-screen flex-col bg-surface-50 dark:bg-surface-950">
        <header class="flex items-center gap-3 border-b border-surface-200 px-4 py-2 dark:border-surface-700">
            <Button icon="pi pi-arrow-left" text rounded @click="router.push({ name: 'vault' })" />
            <span class="flex items-center gap-2 font-semibold">
                <i class="pi pi-trash" /> Papelera
            </span>
        </header>

        <div v-if="loading" class="flex flex-1 items-center justify-center">
            <ProgressSpinner />
        </div>

        <main v-else class="flex-1 overflow-hidden p-2">
            <DataTable :value="vault.trashed" data-key="id" scrollable scroll-height="flex" class="h-full">
                <template #empty>
                    <div class="py-12 text-center text-surface-500">La papelera está vacía.</div>
                </template>
                <Column field="title" header="Título" />
                <Column field="username" header="Usuario" />
                <Column class="w-56" header="">
                    <template #body="{ data }">
                        <div class="flex justify-end gap-2">
                            <Button label="Restaurar" icon="pi pi-undo" text size="small" @click="vault.restoreEntry(data.id)" />
                            <Button label="Eliminar" icon="pi pi-trash" text size="small" severity="danger" @click="purge(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </main>
    </div>
</template>
