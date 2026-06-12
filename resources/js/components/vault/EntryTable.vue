<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useVaultStore, type DecryptedEntry } from '@/stores/vault';
import { useSecretClipboard } from '@/services/clipboard';

const props = defineProps<{ entries: DecryptedEntry[] }>();
const emit = defineEmits<{
    view: [entry: DecryptedEntry];
    edit: [entry: DecryptedEntry];
}>();

const vault = useVaultStore();
const { copy } = useSecretClipboard();

function hostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}
</script>

<template>
    <DataTable
        :value="props.entries"
        data-key="id"
        :rows="20"
        :paginator="props.entries.length > 20"
        scrollable
        scroll-height="flex"
        selection-mode="single"
        @row-click="emit('view', ($event.data as DecryptedEntry))"
        class="h-full"
    >
        <template #empty>
            <div class="py-12 text-center text-surface-500">No hay entradas para mostrar.</div>
        </template>

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
                <div class="flex flex-col">
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
</template>
