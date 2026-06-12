<script setup lang="ts">
import { ref, watch } from 'vue';
import { estimateStrength } from '@/crypto/strength';

const props = defineProps<{ password: string }>();
const emit = defineEmits<{ score: [value: number] }>();

const score = ref(0);
const warning = ref('');
const crackTime = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

watch(
    () => props.password,
    (value) => {
        clearTimeout(timer);
        if (!value) {
            score.value = 0;
            warning.value = '';
            crackTime.value = '';
            emit('score', 0);
            return;
        }
        // zxcvbn se carga de forma diferida; debounce para no recalcular en cada tecla.
        timer = setTimeout(async () => {
            const result = await estimateStrength(value);
            score.value = result.score;
            warning.value = result.warning;
            crackTime.value = result.crackTimeDisplay;
            emit('score', result.score);
        }, 200);
    },
    { immediate: true },
);
</script>

<template>
    <div v-if="props.password" class="flex flex-col gap-1">
        <div class="h-2 w-full overflow-hidden rounded bg-surface-200 dark:bg-surface-700">
            <div class="h-full transition-all duration-300" :style="{ width: `${(score + 1) * 20}%`, background: COLORS[score] }" />
        </div>
        <small :style="{ color: COLORS[score] }">
            {{ LABELS[score] }}
            <span v-if="crackTime" class="text-surface-500">· se descifra en {{ crackTime }}</span>
        </small>
        <small v-if="warning" class="text-surface-500">{{ warning }}</small>
    </div>
</template>
