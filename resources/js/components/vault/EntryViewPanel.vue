<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Drawer from 'primevue/drawer';
import Dialog from 'primevue/dialog';
import Listbox from 'primevue/listbox';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

import { useVaultStore, type DecryptedEntry, type DecryptedFolder } from '@/stores/vault';
import { useSecretClipboard } from '@/services/clipboard';
import TotpDisplay from '@/components/vault/TotpDisplay.vue';

const props = defineProps<{ visible: boolean; entry: DecryptedEntry | null }>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    edit: [entry: DecryptedEntry];
    history: [entry: DecryptedEntry];
}>();

const vault = useVaultStore();
const confirm = useConfirm();
const { copy } = useSecretClipboard();

const revealed = ref(false);
watch(
    () => props.entry?.id,
    () => {
        revealed.value = false;
    },
);

// El TOTP (type=3) se muestra como código en vivo, no como campo crudo.
const totpValue = computed(() => props.entry?.customFields.find((f) => f.type === 3)?.value ?? null);
const visibleFields = computed(() => props.entry?.customFields.filter((f) => f.type !== 3) ?? []);

function confirmDelete(): void {
    const entry = props.entry;
    if (!entry) return;
    confirm.require({
        message: `Se moverá "${entry.title}" a la papelera.`,
        header: 'Eliminar entrada',
        icon: 'pi pi-trash',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Eliminar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            await vault.deleteEntry(entry.id);
            emit('update:visible', false);
        },
    });
}

// --- Mover la entrada a otra carpeta (alternativa al drag&drop, pensado para mobile) ---
const toast = useToast();
const moveVisible = ref(false);
const moveTargetId = ref<string>('__root__'); // '__root__' = Sin carpeta

interface FolderOption {
    id: string;
    label: string;
    depth: number;
}

// Lista plana de carpetas ordenada por jerarquía, con `depth` para indentar.
const folderOptions = computed<FolderOption[]>(() => {
    const byParent = new Map<string | null, DecryptedFolder[]>();
    for (const f of vault.folders) {
        const arr = byParent.get(f.parentId) ?? [];
        arr.push(f);
        byParent.set(f.parentId, arr);
    }
    for (const arr of byParent.values()) {
        arr.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }
    const out: FolderOption[] = [{ id: '__root__', label: 'Sin carpeta', depth: 0 }];
    const walk = (parentId: string | null, depth: number): void => {
        for (const f of byParent.get(parentId) ?? []) {
            out.push({ id: f.id, label: f.name, depth });
            walk(f.id, depth + 1);
        }
    };
    walk(null, 0);
    return out;
});

const currentFolderName = computed(() =>
    props.entry?.folderId
        ? (vault.folders.find((f) => f.id === props.entry!.folderId)?.name ?? 'Carpeta')
        : 'Sin carpeta',
);

const canMove = computed(() => {
    const target = moveTargetId.value === '__root__' ? null : moveTargetId.value;
    return !!props.entry && target !== props.entry.folderId;
});

function openMove(): void {
    moveTargetId.value = props.entry?.folderId ?? '__root__';
    moveVisible.value = true;
}

async function confirmMove(): Promise<void> {
    const entry = props.entry;
    if (!entry) return;
    const target = moveTargetId.value === '__root__' ? null : moveTargetId.value;
    await vault.moveEntry(entry.id, target);
    moveVisible.value = false;
    const name = target === null ? 'Sin carpeta' : (vault.folders.find((f) => f.id === target)?.name ?? 'la carpeta');
    toast.add({ severity: 'success', summary: `"${entry.title}" movida a "${name}"`, life: 2500 });
}
</script>

<template>
    <Drawer
        :visible="props.visible"
        position="right"
        class="!w-full sm:!w-[28rem]"
        @update:visible="emit('update:visible', $event)"
    >
        <template #header>
            <span class="flex items-center gap-2 font-semibold">
                <Button
                    :icon="props.entry?.favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                    text
                    rounded
                    severity="warn"
                    @click="props.entry && vault.toggleFavorite(props.entry.id)"
                />
                {{ props.entry?.title }}
            </span>
        </template>

        <div v-if="props.entry" class="flex flex-col gap-4">
            <!-- Usuario -->
            <div v-if="props.entry.username" class="flex flex-col gap-1">
                <span class="text-xs uppercase text-surface-500">Usuario</span>
                <div class="flex items-center justify-between gap-2 rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">
                    <span class="break-all">{{ props.entry.username }}</span>
                    <Button icon="pi pi-copy" text rounded @click="copy(props.entry.username, 'Usuario copiado')" />
                </div>
            </div>

            <!-- Contraseña -->
            <div v-if="props.entry.password" class="flex flex-col gap-1">
                <span class="text-xs uppercase text-surface-500">Contraseña</span>
                <div class="flex items-center justify-between gap-2 rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">
                    <span class="break-all font-mono">{{ revealed ? props.entry.password : '••••••••••••' }}</span>
                    <div class="flex shrink-0">
                        <Button :icon="revealed ? 'pi pi-eye-slash' : 'pi pi-eye'" text rounded @click="revealed = !revealed" />
                        <Button icon="pi pi-copy" text rounded @click="copy(props.entry.password, 'Contraseña copiada')" />
                    </div>
                </div>
            </div>

            <!-- URL -->
            <div v-if="props.entry.url" class="flex flex-col gap-1">
                <span class="text-xs uppercase text-surface-500">URL</span>
                <div class="flex items-center justify-between gap-2 rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">
                    <a :href="props.entry.url" target="_blank" rel="noopener noreferrer" class="break-all text-primary hover:underline">
                        {{ props.entry.url }}
                    </a>
                    <Button icon="pi pi-copy" text rounded @click="copy(props.entry!.url, 'URL copiada')" />
                </div>
            </div>

            <!-- Código TOTP en vivo -->
            <TotpDisplay v-if="totpValue" :value="totpValue" />

            <!-- Campos personalizados -->
            <div v-for="(field, i) in visibleFields" :key="i" class="flex flex-col gap-1">
                <span class="text-xs uppercase text-surface-500">{{ field.label }}</span>
                <div class="flex items-center justify-between gap-2 rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">
                    <span class="break-all" :class="field.protected ? 'font-mono' : ''">
                        {{ field.protected ? '••••••••' : field.value }}
                    </span>
                    <Button icon="pi pi-copy" text rounded @click="copy(field.value, 'Copiado')" />
                </div>
            </div>

            <!-- Notas -->
            <div v-if="props.entry.notes" class="flex flex-col gap-1">
                <span class="text-xs uppercase text-surface-500">Notas</span>
                <p class="whitespace-pre-wrap rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">{{ props.entry.notes }}</p>
            </div>

            <!-- Etiquetas -->
            <div v-if="props.entry.tagIds.length" class="flex flex-wrap gap-1">
                <Tag
                    v-for="tagId in props.entry.tagIds"
                    :key="tagId"
                    :value="vault.tagById(tagId)?.name"
                    :style="vault.tagById(tagId)?.color ? { background: vault.tagById(tagId)?.color, color: '#fff' } : undefined"
                />
            </div>

            <!-- Carpeta actual -->
            <div class="flex items-center gap-2 text-sm text-surface-500">
                <i class="pi pi-folder text-xs" />
                <span class="truncate">{{ currentFolderName }}</span>
            </div>

            <div class="mt-2 flex flex-wrap gap-2">
                <Button label="Editar" icon="pi pi-pencil" class="flex-1" @click="emit('edit', props.entry)" />
                <Button label="Mover" icon="pi pi-folder-open" severity="secondary" outlined class="flex-1" @click="openMove" />
                <Button icon="pi pi-history" severity="secondary" outlined v-tooltip.top="'Historial'" @click="emit('history', props.entry)" />
                <Button icon="pi pi-trash" severity="danger" outlined v-tooltip.top="'Eliminar'" @click="confirmDelete" />
            </div>
        </div>
    </Drawer>

    <!-- Diálogo para mover la entrada a otra carpeta -->
    <Dialog v-model:visible="moveVisible" modal header="Mover a carpeta" class="mx-4 w-[92vw] max-w-md">
        <div class="max-h-[50vh] overflow-y-auto">
            <Listbox
                v-model="moveTargetId"
                :options="folderOptions"
                option-label="label"
                option-value="id"
                class="w-full !border-0"
            >
                <template #option="{ option }">
                    <span class="flex items-center gap-2" :style="{ paddingLeft: option.depth * 1.1 + 'rem' }">
                        <i :class="option.id === '__root__' ? 'pi pi-inbox' : 'pi pi-folder'" class="text-sm text-surface-500" />
                        <span class="truncate">{{ option.label }}</span>
                    </span>
                </template>
            </Listbox>
        </div>
        <template #footer>
            <Button label="Cancelar" text severity="secondary" @click="moveVisible = false" />
            <Button label="Mover" icon="pi pi-check" :disabled="!canMove" @click="confirmMove" />
        </template>
    </Dialog>
</template>
