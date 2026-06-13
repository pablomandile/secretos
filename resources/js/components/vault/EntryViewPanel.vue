<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';

import { useVaultStore, type DecryptedEntry } from '@/stores/vault';
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

            <div class="mt-2 flex gap-2">
                <Button label="Editar" icon="pi pi-pencil" class="flex-1" @click="emit('edit', props.entry)" />
                <Button icon="pi pi-history" severity="secondary" outlined v-tooltip.top="'Historial'" @click="emit('history', props.entry)" />
                <Button icon="pi pi-trash" severity="danger" outlined v-tooltip.top="'Eliminar'" @click="confirmDelete" />
            </div>
        </div>
    </Drawer>
</template>
