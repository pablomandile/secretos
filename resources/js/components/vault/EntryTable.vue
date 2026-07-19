<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useVaultStore, type DecryptedEntry } from '@/stores/vault';
import { useSecretClipboard } from '@/services/clipboard';

const props = withDefaults(
    defineProps<{ entries: DecryptedEntry[]; selectionMode?: boolean }>(),
    { selectionMode: false },
);
const emit = defineEmits<{
    view: [entry: DecryptedEntry];
    edit: [entry: DecryptedEntry];
}>();

const vault = useVaultStore();
const confirm = useConfirm();
const toast = useToast();
const { copy } = useSecretClipboard();

const selected = ref<DecryptedEntry[]>([]);

// Al cambiar de carpeta/etiqueta/filtro, descartamos la selección para no borrar
// ni mover a ciegas entradas que ya no están a la vista.
watch(() => vault.filter, () => { selected.value = []; }, { deep: true });

// Al apagar el modo selección, limpiamos lo que hubiera marcado.
watch(() => props.selectionMode, (on) => { if (!on) selected.value = []; });

function hostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function confirmBulkDelete(): void {
    const ids = selected.value.map((e) => e.id);
    const count = ids.length;
    if (!count) return;
    confirm.require({
        message: `¿Enviar ${count} ${count === 1 ? 'entrada' : 'entradas'} a la papelera?`,
        header: 'Eliminar selección',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Eliminar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            await vault.deleteEntries(ids);
            selected.value = [];
            toast.add({ severity: 'success', summary: `${count} ${count === 1 ? 'entrada enviada' : 'entradas enviadas'} a la papelera`, life: 2500 });
        },
    });
}

// --- Drag & drop de entradas hacia carpetas (destino en FolderSidebar) ---
function onDragStart(event: DragEvent, entry: DecryptedEntry): void {
    // Si la entrada arrastrada está en la selección, se mueven todas; si no, solo ella.
    const ids = selected.value.some((e) => e.id === entry.id)
        ? selected.value.map((e) => e.id)
        : [entry.id];
    vault.draggingIds = ids;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', ids.join(','));
    }
}

function onDragEnd(): void {
    vault.draggingIds = [];
}

// --- Vista mobile: lista tipo tarjeta en vez de la DataTable ---
const isMobile = useMediaQuery('(max-width: 767px)');

// Selección con checkbox por tarjeta (equivalente a la de la DataTable en desktop).
function isSelected(entry: DecryptedEntry): boolean {
    return selected.value.some((e) => e.id === entry.id);
}
function toggleSelected(entry: DecryptedEntry): void {
    selected.value = isSelected(entry)
        ? selected.value.filter((e) => e.id !== entry.id)
        : [...selected.value, entry];
}
function onCardClick(entry: DecryptedEntry): void {
    if (props.selectionMode) toggleSelected(entry);
    else emit('view', entry);
}

// Menú "⋮" por tarjeta con las acciones que en desktop son botones sueltos.
const rowMenu = ref();
const menuEntry = ref<DecryptedEntry | null>(null);
const rowMenuItems = computed<MenuItem[]>(() => {
    const e = menuEntry.value;
    if (!e) return [];
    const items: MenuItem[] = [];
    if (e.username) items.push({ label: 'Copiar usuario', icon: 'pi pi-user', command: () => copy(e.username, 'Usuario copiado') });
    if (e.password) items.push({ label: 'Copiar contraseña', icon: 'pi pi-key', command: () => copy(e.password, 'Contraseña copiada') });
    items.push({ label: 'Editar', icon: 'pi pi-pencil', command: () => emit('edit', e) });
    return items;
});
function openRowMenu(event: Event, entry: DecryptedEntry): void {
    menuEntry.value = entry;
    rowMenu.value?.toggle(event);
}
</script>

<template>
    <div class="flex h-full flex-col">
        <!-- Barra de acción para la selección múltiple -->
        <div
            v-if="selected.length"
            class="mb-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm"
        >
            <span class="font-medium text-primary">
                {{ selected.length }} {{ selected.length === 1 ? 'seleccionada' : 'seleccionadas' }}
            </span>
            <span class="hidden text-xs text-surface-500 sm:inline">· arrastrá a una carpeta para mover</span>
            <div class="ml-auto flex gap-2">
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" size="small" @click="confirmBulkDelete" />
                <Button label="Limpiar" icon="pi pi-times" severity="secondary" text size="small" @click="selected = []" />
            </div>
        </div>

        <DataTable
            v-if="!isMobile"
            v-model:selection="selected"
            :value="props.entries"
            data-key="id"
            :rows="20"
            :paginator="props.entries.length > 20"
            scrollable
            scroll-height="flex"
            @row-click="emit('view', ($event.data as DecryptedEntry))"
            class="min-h-0 flex-1"
        >
            <template #empty>
                <div class="py-12 text-center text-surface-500">No hay entradas para mostrar.</div>
            </template>

            <Column v-if="props.selectionMode" selection-mode="multiple" header-style="width: 3rem" />

            <Column class="w-12">
                <template #body="{ data }">
                    <Button
                        :icon="data.favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                        text
                        rounded
                        severity="warn"
                        @click.stop="vault.toggleFavorite(data.id)"
                    />
                </template>
            </Column>

            <Column field="title" header="Título" sortable>
                <template #body="{ data }">
                    <div
                        class="flex cursor-move flex-col"
                        draggable="true"
                        v-tooltip.top="'Arrastrá a una carpeta para mover'"
                        @dragstart="onDragStart($event, data)"
                        @dragend="onDragEnd"
                    >
                        <span class="font-medium">{{ data.title }}</span>
                        <span v-if="data.url" class="text-xs text-surface-500">{{ hostname(data.url) }}</span>
                    </div>
                </template>
            </Column>

            <Column field="username" header="Usuario" />

            <Column header="Etiquetas">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag
                            v-for="tagId in data.tagIds"
                            :key="tagId"
                            :value="vault.tagById(tagId)?.name"
                            :style="vault.tagById(tagId)?.color ? { background: vault.tagById(tagId)?.color } : undefined"
                        />
                    </div>
                </template>
            </Column>

            <Column class="w-44" header="">
                <template #body="{ data }">
                    <div class="flex justify-end gap-1">
                        <Button
                            v-if="data.username"
                            icon="pi pi-user"
                            text
                            rounded
                            v-tooltip.top="'Copiar usuario'"
                            @click.stop="copy(data.username, 'Usuario copiado')"
                        />
                        <Button
                            v-if="data.password"
                            icon="pi pi-key"
                            text
                            rounded
                            v-tooltip.top="'Copiar contraseña'"
                            @click.stop="copy(data.password, 'Contraseña copiada')"
                        />
                        <Button
                            icon="pi pi-pencil"
                            text
                            rounded
                            v-tooltip.top="'Editar'"
                            @click.stop="emit('edit', data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Mobile: lista tipo tarjeta -->
        <div v-else class="min-h-0 flex-1 overflow-y-auto">
            <div v-if="!props.entries.length" class="py-12 text-center text-surface-500">
                No hay entradas para mostrar.
            </div>
            <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700">
                <li
                    v-for="entry in props.entries"
                    :key="entry.id"
                    class="flex items-center gap-2 py-3 pr-1"
                    :class="props.selectionMode && isSelected(entry) ? 'bg-primary/10' : ''"
                    @click="onCardClick(entry)"
                >
                    <Checkbox
                        v-if="props.selectionMode"
                        :model-value="isSelected(entry)"
                        binary
                        class="ml-1 shrink-0"
                        @click.stop
                        @update:model-value="toggleSelected(entry)"
                    />
                    <Button
                        v-else
                        :icon="entry.favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                        text
                        rounded
                        severity="warn"
                        class="shrink-0"
                        @click.stop="vault.toggleFavorite(entry.id)"
                    />
                    <div class="min-w-0 flex-1">
                        <div class="truncate font-medium">{{ entry.title }}</div>
                        <div v-if="entry.username" class="truncate text-sm text-surface-500">{{ entry.username }}</div>
                        <div v-else-if="entry.url" class="truncate text-xs text-surface-400">{{ hostname(entry.url) }}</div>
                        <div v-if="entry.tagIds.length" class="mt-1 flex flex-wrap gap-1">
                            <Tag
                                v-for="tagId in entry.tagIds"
                                :key="tagId"
                                :value="vault.tagById(tagId)?.name"
                                :style="vault.tagById(tagId)?.color ? { background: vault.tagById(tagId)?.color } : undefined"
                            />
                        </div>
                    </div>
                    <Button
                        v-if="entry.password"
                        icon="pi pi-key"
                        text
                        rounded
                        class="shrink-0"
                        v-tooltip.left="'Copiar contraseña'"
                        @click.stop="copy(entry.password, 'Contraseña copiada')"
                    />
                    <Button
                        icon="pi pi-ellipsis-v"
                        text
                        rounded
                        severity="secondary"
                        class="shrink-0"
                        aria-label="Más acciones"
                        @click.stop="openRowMenu($event, entry)"
                    />
                </li>
            </ul>
        </div>

        <Menu ref="rowMenu" :model="rowMenuItems" popup />
    </div>
</template>
