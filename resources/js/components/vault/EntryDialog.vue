<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import { useToast } from 'primevue/usetoast';

import { useVaultStore, type DecryptedEntry, type EntryInput } from '@/stores/vault';
import { generatePassword, DEFAULT_GENERATOR_OPTIONS } from '@/crypto/generator';

const props = defineProps<{ visible: boolean; entry: DecryptedEntry | null }>();
const emit = defineEmits<{ 'update:visible': [value: boolean] }>();

const vault = useVaultStore();
const toast = useToast();
const saving = ref(false);

interface FieldRow {
    label: string;
    value: string;
    type: number;
    protected: boolean;
}

const form = reactive<{
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    folderId: string | null;
    tagIds: string[];
    customFields: FieldRow[];
}>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    folderId: null,
    tagIds: [],
    customFields: [],
});

// Reinicia el formulario cada vez que se abre.
watch(
    () => props.visible,
    (open) => {
        if (!open) return;
        const e = props.entry;
        form.title = e?.title ?? '';
        form.username = e?.username ?? '';
        form.password = e?.password ?? '';
        form.url = e?.url ?? '';
        form.notes = e?.notes ?? '';
        form.folderId = e?.folderId ?? null;
        form.tagIds = e ? [...e.tagIds] : [];
        form.customFields = e
            ? e.customFields.map((f) => ({ label: f.label, value: f.value, type: f.type, protected: f.protected }))
            : [];
    },
);

function close(): void {
    emit('update:visible', false);
}

function generate(): void {
    form.password = generatePassword(DEFAULT_GENERATOR_OPTIONS);
}

function addCustomField(): void {
    form.customFields.push({ label: '', value: '', type: 1, protected: false });
}

function removeCustomField(index: number): void {
    form.customFields.splice(index, 1);
}

// Etiquetas: crear una nueva al vuelo.
const newTagName = ref('');
async function createTag(): Promise<void> {
    const name = newTagName.value.trim();
    if (!name) return;
    const tag = await vault.createTag(name);
    form.tagIds.push(tag.id);
    newTagName.value = '';
}

async function save(): Promise<void> {
    if (!form.title.trim()) {
        toast.add({ severity: 'warn', summary: 'Falta el título', life: 2500 });
        return;
    }
    saving.value = true;
    try {
        const input: EntryInput = {
            type: 1,
            title: form.title,
            username: form.username,
            password: form.password,
            url: form.url,
            notes: form.notes,
            favorite: props.entry?.favorite ?? false,
            folderId: form.folderId,
            tagIds: form.tagIds,
            customFields: form.customFields
                .filter((f) => f.label.trim() || f.value.trim())
                .map((f) => ({ label: f.label, value: f.value, type: f.protected ? 2 : 1, protected: f.protected })),
        };
        if (props.entry) {
            await vault.updateEntry(props.entry.id, input);
        } else {
            await vault.createEntry(input);
        }
        toast.add({ severity: 'success', summary: 'Guardado', life: 2000 });
        close();
    } catch {
        toast.add({ severity: 'error', summary: 'No se pudo guardar', life: 3000 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="props.visible"
        modal
        maximizable
        :header="props.entry ? 'Editar entrada' : 'Nueva entrada'"
        class="w-full max-w-2xl"
        @update:visible="emit('update:visible', $event)"
    >
        <form class="flex flex-col gap-4" @submit.prevent="save">
            <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Título</label>
                <InputText v-model="form.title" autofocus />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">Usuario</label>
                    <InputText v-model="form.username" autocomplete="off" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">Contraseña</label>
                    <div class="flex gap-2">
                        <Password v-model="form.password" :feedback="false" toggle-mask input-class="w-full" class="flex-1" />
                        <Button icon="pi pi-refresh" outlined v-tooltip.top="'Generar'" @click="generate" />
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">URL</label>
                <InputText v-model="form.url" placeholder="https://" />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">Carpeta</label>
                    <Select
                        v-model="form.folderId"
                        :options="vault.folders"
                        option-label="name"
                        option-value="id"
                        placeholder="Sin carpeta"
                        show-clear
                    />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">Etiquetas</label>
                    <MultiSelect
                        v-model="form.tagIds"
                        :options="vault.tags"
                        option-label="name"
                        option-value="id"
                        placeholder="Seleccionar"
                        display="chip"
                        filter
                    />
                    <div class="mt-1 flex gap-2">
                        <InputText v-model="newTagName" placeholder="Nueva etiqueta" class="flex-1" @keydown.enter.prevent="createTag" />
                        <Button icon="pi pi-plus" outlined @click="createTag" />
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Notas</label>
                <Textarea v-model="form.notes" rows="3" auto-resize />
            </div>

            <!-- Campos personalizados -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <label class="text-sm font-medium">Campos personalizados</label>
                    <Button label="Agregar" icon="pi pi-plus" text size="small" @click="addCustomField" />
                </div>
                <div v-for="(field, i) in form.customFields" :key="i" class="flex items-center gap-2">
                    <InputText v-model="field.label" placeholder="Etiqueta" class="w-1/3" />
                    <Password
                        v-if="field.protected"
                        v-model="field.value"
                        :feedback="false"
                        toggle-mask
                        input-class="w-full"
                        class="flex-1"
                    />
                    <InputText v-else v-model="field.value" placeholder="Valor" class="flex-1" />
                    <Checkbox v-model="field.protected" binary v-tooltip.top="'Ocultar valor'" />
                    <Button icon="pi pi-trash" text rounded severity="danger" @click="removeCustomField(i)" />
                </div>
            </div>
        </form>

        <template #footer>
            <Button label="Cancelar" text @click="close" />
            <Button label="Guardar" icon="pi pi-check" :loading="saving" @click="save" />
        </template>
    </Dialog>
</template>
