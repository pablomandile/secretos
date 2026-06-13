<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import Button from 'primevue/button';

import { generateTotp, normalizeTotpInput, totpRemaining, type OtpauthConfig } from '@/crypto/totp';
import { useSecretClipboard } from '@/services/clipboard';

const props = defineProps<{ value: string }>();
const { copy } = useSecretClipboard();

const code = ref('');
const remaining = ref(0);
const invalid = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

const config = computed<OtpauthConfig | null>(() => {
    try {
        return normalizeTotpInput(props.value);
    } catch {
        return null;
    }
});

const period = computed(() => config.value?.period ?? 30);
const formatted = computed(() =>
    code.value.length === 6 ? `${code.value.slice(0, 3)} ${code.value.slice(3)}` : code.value,
);

async function tick(): Promise<void> {
    if (!config.value) {
        invalid.value = true;
        code.value = '';
        return;
    }
    try {
        const now = Date.now();
        code.value = await generateTotp(config.value.secret, {
            timestamp: now,
            period: config.value.period,
            digits: config.value.digits,
            algorithm: config.value.algorithm,
        });
        remaining.value = totpRemaining(config.value.period, now);
        invalid.value = false;
    } catch {
        invalid.value = true;
        code.value = '';
    }
}

onMounted(() => {
    tick();
    timer = setInterval(tick, 1000);
});
onUnmounted(() => clearInterval(timer));
watch(() => props.value, tick);
</script>

<template>
    <div class="flex flex-col gap-1">
        <span class="text-xs uppercase text-surface-500">Código 2FA (TOTP)</span>
        <div class="flex items-center justify-between gap-2 rounded-md bg-surface-100 px-3 py-2 dark:bg-surface-800">
            <template v-if="invalid">
                <span class="text-sm text-red-500">Secreto TOTP inválido</span>
            </template>
            <template v-else>
                <span class="font-mono text-lg tracking-wider">{{ formatted }}</span>
                <div class="flex items-center gap-2">
                    <span
                        class="text-sm tabular-nums"
                        :class="remaining <= 5 ? 'text-red-500' : 'text-surface-500'"
                    >
                        {{ remaining }}s
                    </span>
                    <Button icon="pi pi-copy" text rounded @click="copy(code, 'Código copiado')" />
                </div>
            </template>
        </div>
        <div v-if="!invalid" class="h-1 w-full overflow-hidden rounded bg-surface-200 dark:bg-surface-700">
            <div
                class="h-full bg-primary transition-all duration-1000 ease-linear"
                :style="{ width: `${(remaining / period) * 100}%` }"
            />
        </div>
    </div>
</template>
