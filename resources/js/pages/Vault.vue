<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';

import { useAuthStore } from '@/stores/auth';
import { useKeychainStore } from '@/stores/keychain';
import { useVaultStore, type DecryptedEntry } from '@/stores/vault';
import FolderSidebar from '@/components/vault/FolderSidebar.vue';
import EntryTable from '@/components/vault/EntryTable.vue';
import EntryDialog from '@/components/vault/EntryDialog.vue';
import EntryViewPanel from '@/components/vault/EntryViewPanel.vue';

const auth = useAuthStore();
const keychain = useKeychainStore();
const vault = useVaultStore();
const router = useRouter();

const loading = ref(true);
const dialogVisible = ref(false);
const drawerVisible = ref(false);
const editingEntry = ref<DecryptedEntry | null>(null);

onMounted(async () => {
    if (!vault.loaded) {
        await vault.load();
    }
    loading.value = false;
});

function openNew(): void {
    editingEntry.value = null;
    dialogVisible.value = true;
}

function openView(entry: DecryptedEntry): void {
    vault.selectedId = entry.id;
    drawerVisible.value = true;
}

function openEdit(entry: DecryptedEntry): void {
    editingEntry.value = entry;
    drawerVisible.value = false;
    dialogVisible.value = true;
}

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
    <div class="flex h-screen flex-col bg-surface-50 dark:bg-surface-950">
        <!-- Barra superior -->
        <header class="flex items-center gap-3 border-b border-surface-200 px-4 py-2 dark:border-surface-700">
            <span class="flex items-center gap-2 font-semibold text-primary">
                <i class="pi pi-lock" /> Secretos
            </span>
            <IconField class="ml-2 flex-1 max-w-md">
                <InputIcon class="pi pi-search" />
                <InputText v-model="vault.query" placeholder="Buscar…" class="w-full" />
            </IconField>
            <Button label="Nueva" icon="pi pi-plus" @click="openNew" />
            <Button icon="pi pi-lock" severity="secondary" text rounded v-tooltip.bottom="'Bloquear'" @click="lock" />
            <Button icon="pi pi-sign-out" severity="secondary" text rounded v-tooltip.bottom="'Cerrar sesión'" @click="logout" />
        </header>

        <div v-if="loading" class="flex flex-1 items-center justify-center">
            <ProgressSpinner />
        </div>

        <div v-else class="flex flex-1 overflow-hidden">
            <FolderSidebar />
            <main class="flex-1 overflow-hidden p-2">
                <EntryTable :entries="vault.filteredEntries" @view="openView" @edit="openEdit" />
            </main>
        </div>

        <EntryDialog v-model:visible="dialogVisible" :entry="editingEntry" />
        <EntryViewPanel v-model:visible="drawerVisible" :entry="vault.selectedEntry" @edit="openEdit" />
    </div>
</template>
