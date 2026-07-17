<script setup lang="ts">
import { computed, ref } from 'vue';
import Tree from 'primevue/tree';
import type { TreeNode } from 'primevue/treenode';
import type { TreeSelectionKeys } from 'primevue/tree';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ContextMenu from 'primevue/contextmenu';
import type { MenuItem } from 'primevue/menuitem';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

import { useVaultStore, type VaultFilter } from '@/stores/vault';

const vault = useVaultStore();
const confirm = useConfirm();
const toast = useToast();

// --- Drag & drop: mover entradas a carpetas (origen: EntryTable) ---
// Guarda la clave del destino sobre el que se está arrastrando, para resaltarlo.
const dropTarget = ref<string | null>(null);

async function moveDraggedTo(folderId: string | null): Promise<void> {
    dropTarget.value = null;
    const ids = [...vault.draggingIds];
    vault.draggingIds = [];
    if (!ids.length) return;
    const moved = await vault.moveEntries(ids, folderId);
    if (moved > 0) {
        const dest = folderId === null
            ? 'Sin carpeta'
            : (vault.folders.find((f) => f.id === folderId)?.name ?? 'la carpeta');
        toast.add({
            severity: 'success',
            summary: `${moved} ${moved === 1 ? 'entrada movida' : 'entradas movidas'} a "${dest}"`,
            life: 2500,
        });
    }
}

function onSmartDragOver(event: DragEvent, key: string): void {
    if (key !== 'unfiled' || !vault.draggingIds.length) return;
    event.preventDefault();
    dropTarget.value = 'unfiled';
}

function onFolderDragOver(event: DragEvent, key: string): void {
    if (!vault.draggingIds.length) return;
    event.preventDefault();
    dropTarget.value = key;
}

const smartFilters = computed(() => [
    { key: 'all', label: 'Todas', icon: 'pi pi-list', filter: { type: 'all' } as VaultFilter, count: vault.entries.length },
    { key: 'favorites', label: 'Favoritas', icon: 'pi pi-star', filter: { type: 'favorites' } as VaultFilter, count: vault.favoritesCount },
    { key: 'unfiled', label: 'Sin carpeta', icon: 'pi pi-inbox', filter: { type: 'unfiled' } as VaultFilter, count: vault.entries.filter((e) => !e.folderId).length },
]);

function isActive(f: VaultFilter): boolean {
    return JSON.stringify(vault.filter) === JSON.stringify(f);
}

// Árbol de carpetas a partir de la lista plana (parent_id).
const folderTree = computed<TreeNode[]>(() => {
    const byParent = new Map<string | null, TreeNode[]>();
    for (const folder of vault.folders) {
        const node: TreeNode = { key: folder.id, label: folder.name, icon: 'pi pi-folder', children: [] };
        const siblings = byParent.get(folder.parentId) ?? [];
        siblings.push(node);
        byParent.set(folder.parentId, siblings);
    }
    const attach = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => ({ ...n, children: attach(byParent.get(n.key as string) ?? []) }));
    return attach(byParent.get(null) ?? []);
});

const selectedKeys = computed<TreeSelectionKeys>(() =>
    vault.filter.type === 'folder' ? { [vault.filter.id]: true } : {},
);

function onFolderSelect(node: TreeNode): void {
    vault.filter = { type: 'folder', id: node.key as string };
}

// --- Menú contextual de carpetas ---
const folderMenu = ref<InstanceType<typeof ContextMenu>>();
const menuFolderId = ref<string | null>(null);
const menuItems: MenuItem[] = [
    { label: 'Nueva subcarpeta', icon: 'pi pi-plus', command: () => openDialog('subfolder') },
    { label: 'Renombrar', icon: 'pi pi-pencil', command: () => openDialog('rename') },
    { label: 'Eliminar', icon: 'pi pi-trash', command: () => removeFolder() },
];

function onFolderContext(event: { originalEvent: Event; node: TreeNode }): void {
    menuFolderId.value = event.node.key as string;
    folderMenu.value?.show(event.originalEvent);
}

// --- Diálogo nueva/renombrar carpeta ---
const dialogVisible = ref(false);
const dialogMode = ref<'new' | 'rename' | 'subfolder'>('new');
const folderName = ref('');
const saving = ref(false);

function openDialog(mode: 'new' | 'rename' | 'subfolder'): void {
    dialogMode.value = mode;
    folderName.value =
        mode === 'rename' ? (vault.folders.find((f) => f.id === menuFolderId.value)?.name ?? '') : '';
    dialogVisible.value = true;
}

async function saveFolder(): Promise<void> {
    const name = folderName.value.trim();
    if (!name) return;
    saving.value = true;
    try {
        if (dialogMode.value === 'rename' && menuFolderId.value) {
            await vault.renameFolder(menuFolderId.value, name);
        } else if (dialogMode.value === 'subfolder' && menuFolderId.value) {
            await vault.createFolder(name, menuFolderId.value);
        } else {
            await vault.createFolder(name, null);
        }
        dialogVisible.value = false;
    } finally {
        saving.value = false;
    }
}

function removeFolder(): void {
    if (!menuFolderId.value) return;
    const id = menuFolderId.value;
    confirm.require({
        message: 'Las entradas de esta carpeta quedarán sin carpeta (no se borran). ¿Eliminar?',
        header: 'Eliminar carpeta',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Eliminar',
        acceptClass: 'p-button-danger',
        accept: () => vault.deleteFolder(id),
    });
}

function selectTag(id: string): void {
    vault.filter = { type: 'tag', id };
}
</script>

<template>
    <aside class="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-surface-200 p-3 dark:border-surface-700">
        <!-- Filtros rápidos -->
        <ul class="flex flex-col gap-1">
            <li v-for="f in smartFilters" :key="f.key">
                <button
                    class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
                    :class="[
                        isActive(f.filter) ? 'bg-primary/10 font-medium text-primary' : '',
                        f.key === 'unfiled' && dropTarget === 'unfiled' ? 'ring-2 ring-inset ring-primary' : '',
                    ]"
                    @click="vault.filter = f.filter"
                    @dragover="onSmartDragOver($event, f.key)"
                    @dragleave="dropTarget = null"
                    @drop="f.key === 'unfiled' && moveDraggedTo(null)"
                >
                    <span class="flex items-center gap-2"><i :class="f.icon" />{{ f.label }}</span>
                    <span class="text-xs text-surface-400">{{ f.count }}</span>
                </button>
            </li>
        </ul>

        <!-- Carpetas -->
        <div>
            <div class="mb-1 flex items-center justify-between px-2">
                <span class="text-xs font-semibold uppercase text-surface-500">Carpetas</span>
                <Button icon="pi pi-plus" text rounded size="small" v-tooltip.top="'Nueva carpeta'" @click="openDialog('new')" />
            </div>
            <Tree
                v-if="folderTree.length"
                :value="folderTree"
                selection-mode="single"
                :selection-keys="selectedKeys"
                @node-select="onFolderSelect"
                @node-contextmenu="onFolderContext"
                class="!border-0 !p-0"
            >
                <template #default="{ node }">
                    <span
                        class="block w-full rounded"
                        :class="dropTarget === node.key ? 'bg-primary/20 ring-2 ring-inset ring-primary' : ''"
                        @dragover="onFolderDragOver($event, node.key as string)"
                        @dragleave="dropTarget = null"
                        @drop="moveDraggedTo(node.key as string)"
                    >{{ node.label }}</span>
                </template>
            </Tree>
            <p v-else class="px-3 py-1 text-xs text-surface-400">Sin carpetas todavía.</p>
            <ContextMenu ref="folderMenu" :model="menuItems" />
        </div>

        <!-- Etiquetas -->
        <div v-if="vault.tags.length">
            <span class="mb-1 block px-2 text-xs font-semibold uppercase text-surface-500">Etiquetas</span>
            <div class="flex flex-wrap gap-1 px-2">
                <Tag
                    v-for="tag in vault.tags"
                    :key="tag.id"
                    :value="tag.name"
                    class="cursor-pointer"
                    :severity="vault.filter.type === 'tag' && vault.filter.id === tag.id ? 'primary' : 'secondary'"
                    :style="tag.color ? { background: tag.color, color: '#fff' } : undefined"
                    @click="selectTag(tag.id)"
                />
            </div>
        </div>

        <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'" class="w-80">
            <form @submit.prevent="saveFolder">
                <InputText v-model="folderName" class="w-full" placeholder="Nombre" autofocus />
                <div class="mt-4 flex justify-end gap-2">
                    <Button label="Cancelar" text @click="dialogVisible = false" />
                    <Button label="Guardar" type="submit" :loading="saving" />
                </div>
            </form>
        </Dialog>
    </aside>
</template>
