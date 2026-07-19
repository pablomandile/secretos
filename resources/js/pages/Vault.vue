<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';

import { useAuthStore } from '@/stores/auth';
import { useKeychainStore } from '@/stores/keychain';
import { useVaultStore, type DecryptedEntry } from '@/stores/vault';
import AppLogo from '@/components/AppLogo.vue';
import FolderSidebar from '@/components/vault/FolderSidebar.vue';
import EntryTable from '@/components/vault/EntryTable.vue';
import EntryDialog from '@/components/vault/EntryDialog.vue';
import EntryViewPanel from '@/components/vault/EntryViewPanel.vue';
import VersionHistoryDialog from '@/components/vault/VersionHistoryDialog.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const keychain = useKeychainStore();
const vault = useVaultStore();
const router = useRouter();

const loading = ref(true);
const dialogVisible = ref(false);
const drawerVisible = ref(false);
const historyVisible = ref(false);
const historyEntryId = ref<string | null>(null);
const editingEntry = ref<DecryptedEntry | null>(null);
const selectionMode = ref(false); // muestra/oculta las casillas para borrado múltiple

// --- Responsive: en mobile el sidebar de carpetas pasa a un drawer lateral ---
const isDesktop = useMediaQuery('(min-width: 768px)');
const mobileSidebar = ref(false);
// Al elegir carpeta/etiqueta/filtro cerramos el drawer para dejar ver las claves.
watch(() => vault.filter, () => { mobileSidebar.value = false; }, { deep: true });
// Si se pasa a desktop con el drawer abierto, lo cerramos para no dejarlo colgado.
watch(isDesktop, (d) => { if (d) mobileSidebar.value = false; });

onMounted(async () => {
    if (!vault.loaded) {
        await vault.load();
    }
    loading.value = false;
    // Si venimos de otra vista con una entrada seleccionada (p.ej. Salud), la abrimos.
    if (vault.selectedId) {
        drawerVisible.value = true;
    }
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

function openHistory(entry: DecryptedEntry): void {
    historyEntryId.value = entry.id;
    drawerVisible.value = false;
    historyVisible.value = true;
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
        <header class="flex flex-col gap-2 border-b border-surface-200 px-3 py-2 dark:border-surface-700 md:flex-row md:items-center md:gap-3 md:px-4">
            <!-- Fila 1: logo + búsqueda + Nueva. En desktop es `contents` y fluye en la fila del header. -->
            <div class="flex items-center gap-2 md:contents">
                <!-- Wordmark en desktop; ícono cuadrado en mobile -->
                <AppLogo class="hidden h-8 w-auto shrink-0 md:block" />
                <AppLogo solo class="h-8 w-8 shrink-0 md:hidden" />
                <IconField class="flex-1 md:ml-2 md:max-w-md">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="vault.query" placeholder="Buscar…" class="w-full" />
                </IconField>
                <Button :label="isDesktop ? 'Nueva' : undefined" icon="pi pi-plus" class="shrink-0" @click="openNew" />
            </div>
            <!-- Fila 2 en mobile (repartida a lo ancho); en desktop, grupo inline al final del header -->
            <div class="flex items-center justify-between gap-1 md:justify-normal md:gap-2">
                <!-- Carpetas: solo mobile -->
                <Button icon="pi pi-bars" severity="secondary" text rounded class="md:hidden" aria-label="Carpetas" @click="mobileSidebar = true" />
                <Button
                    :icon="selectionMode ? 'pi pi-check-square' : 'pi pi-stop'"
                    :severity="selectionMode ? 'primary' : 'secondary'"
                    :text="!selectionMode"
                    :outlined="selectionMode"
                    rounded
                    v-tooltip.bottom="selectionMode ? 'Salir del modo selección' : 'Seleccionar para borrado múltiple'"
                    @click="selectionMode = !selectionMode"
                />
                <ThemeToggle />
                <Button icon="pi pi-shield" severity="secondary" text rounded v-tooltip.bottom="'Salud de contraseñas'" @click="router.push({ name: 'health' })" />
                <Button icon="pi pi-trash" severity="secondary" text rounded v-tooltip.bottom="'Papelera'" @click="router.push({ name: 'trash' })" />
                <Button icon="pi pi-cog" severity="secondary" text rounded v-tooltip.bottom="'Ajustes'" @click="router.push({ name: 'settings' })" />
                <Button icon="pi pi-lock" severity="secondary" text rounded v-tooltip.bottom="'Bloquear'" @click="lock" />
                <Button icon="pi pi-sign-out" severity="secondary" text rounded v-tooltip.bottom="'Cerrar sesión'" @click="logout" />
            </div>
        </header>

        <div v-if="loading" class="flex flex-1 items-center justify-center">
            <ProgressSpinner />
        </div>

        <div v-else class="flex flex-1 overflow-hidden">
            <!-- Sidebar inline: solo desktop (`contents` para que el <aside> fluya en la fila) -->
            <div class="hidden md:contents">
                <FolderSidebar />
            </div>
            <main class="flex-1 overflow-hidden p-2">
                <EntryTable :entries="vault.filteredEntries" :selection-mode="selectionMode" @view="openView" @edit="openEdit" />
            </main>
        </div>

        <!-- Footer mínimo para enmarcar la página -->
        <footer class="shrink-0 border-t border-surface-200 px-4 py-1.5 text-center text-xs text-surface-400 dark:border-surface-700">
            <span class="inline-flex items-center gap-1.5">
                <i class="pi pi-lock text-[10px]" />
                Secretos · cifrado de extremo a extremo
            </span>
        </footer>

        <!-- Carpetas como drawer lateral en mobile (reutiliza el mismo FolderSidebar) -->
        <Drawer v-model:visible="mobileSidebar" position="left" header="Carpetas" class="!w-72" :pt="{ content: { class: '!p-0' } }">
            <FolderSidebar class="!w-full !border-0" />
        </Drawer>

        <EntryDialog v-model:visible="dialogVisible" :entry="editingEntry" />
        <EntryViewPanel v-model:visible="drawerVisible" :entry="vault.selectedEntry" @edit="openEdit" @history="openHistory" />
        <VersionHistoryDialog v-model:visible="historyVisible" :entry-id="historyEntryId" />
    </div>
</template>
