<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Slider from 'primevue/slider';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import { buildCharset, generatePassword, DEFAULT_GENERATOR_OPTIONS, type GeneratorOptions } from '@/crypto/generator';
import { useSecretClipboard } from '@/services/clipboard';
import StrengthMeter from '@/components/generator/StrengthMeter.vue';

const emit = defineEmits<{ use: [password: string] }>();

const opts = reactive<GeneratorOptions>({ ...DEFAULT_GENERATOR_OPTIONS });
const value = ref('');
const { copy } = useSecretClipboard();

const canGenerate = computed(() => buildCharset(opts).length > 0);

function regenerate(): void {
    if (!canGenerate.value) {
        value.value = '';
        return;
    }
    value.value = generatePassword(opts);
}

onMounted(regenerate);
watch(opts, regenerate, { deep: true });

const toggles = [
    { key: 'uppercase', label: 'A-Z' },
    { key: 'lowercase', label: 'a-z' },
    { key: 'digits', label: '0-9' },
    { key: 'symbols', label: '!@#$' },
] as const;
</script>

<template>
    <div class="flex w-80 flex-col gap-3">
        <!-- Valor generado -->
        <div class="flex gap-2">
            <InputText :model-value="value" readonly class="flex-1 font-mono" />
            <Button icon="pi pi-refresh" outlined v-tooltip.top="'Regenerar'" :disabled="!canGenerate" @click="regenerate" />
            <Button icon="pi pi-copy" outlined v-tooltip.top="'Copiar'" :disabled="!value" @click="copy(value, 'Copiado')" />
        </div>

        <StrengthMeter :password="value" />

        <!-- Longitud -->
        <div class="flex flex-col gap-1">
            <div class="flex justify-between text-sm">
                <span>Longitud</span>
                <span class="font-medium">{{ opts.length }}</span>
            </div>
            <Slider v-model="opts.length" :min="8" :max="64" />
        </div>

        <!-- Conjuntos de caracteres -->
        <div class="grid grid-cols-2 gap-2">
            <label v-for="t in toggles" :key="t.key" class="flex items-center gap-2 text-sm">
                <Checkbox v-model="opts[t.key]" binary />
                <span class="font-mono">{{ t.label }}</span>
            </label>
        </div>
        <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="opts.excludeAmbiguous" binary />
            <span>Excluir ambiguos (O0Il1|)</span>
        </label>

        <Button label="Usar esta contraseña" icon="pi pi-check" :disabled="!value" @click="emit('use', value)" />
    </div>
</template>
