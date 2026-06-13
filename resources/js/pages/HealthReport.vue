<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Knob from 'primevue/knob';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';

import { useVaultStore } from '@/stores/vault';
import { analyzeVault, type HealthReport } from '@/services/health';

const vault = useVaultStore();
const router = useRouter();

const report = ref<HealthReport | null>(null);
const computing = ref(true);
const progress = ref(0);

const WEAK_LABELS = ['Muy débil', 'Débil', 'Aceptable'];

const scoreColor = computed(() => {
    const s = report.value?.score ?? 0;
    return s >= 80 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';
});
const scoreLabel = computed(() => {
    const s = report.value?.score ?? 0;
    return s >= 80 ? 'Buena' : s >= 50 ? 'Mejorable' : 'Riesgosa';
});

async function compute(): Promise<void> {
    computing.value = true;
    progress.value = 0;
    report.value = await analyzeVault(vault.entries, {
        onProgress: (done, total) => {
            progress.value = total ? Math.round((done / total) * 100) : 100;
        },
    });
    computing.value = false;
}

function openEntry(id: string): void {
    vault.selectedId = id;
    router.push({ name: 'vault' });
}

onMounted(compute);
</script>

<template>
    <div class="flex min-h-screen flex-col bg-surface-50 dark:bg-surface-950">
        <header class="flex items-center gap-3 border-b border-surface-200 px-4 py-2 dark:border-surface-700">
            <Button icon="pi pi-arrow-left" text rounded @click="router.push({ name: 'vault' })" />
            <span class="flex items-center gap-2 font-semibold"><i class="pi pi-shield" /> Salud de contraseñas</span>
            <Button
                icon="pi pi-refresh"
                text
                rounded
                class="ml-auto"
                :disabled="computing"
                v-tooltip.bottom="'Recalcular'"
                @click="compute"
            />
        </header>

        <div v-if="computing" class="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <ProgressBar :value="progress" class="w-64" />
            <span class="text-sm text-surface-500">Analizando {{ vault.entries.length }} entradas…</span>
        </div>

        <main v-else-if="report" class="mx-auto w-full max-w-3xl space-y-6 p-4">
            <!-- Score -->
            <Card>
                <template #content>
                    <div class="flex items-center gap-6">
                        <Knob :model-value="report.score" readonly :value-color="scoreColor" :size="120" value-template="{value}" />
                        <div>
                            <div class="text-xl font-semibold" :style="{ color: scoreColor }">{{ scoreLabel }}</div>
                            <p class="text-sm text-surface-500">
                                {{ report.withPassword }} contraseñas analizadas ·
                                {{ report.weak.length }} débiles ·
                                {{ report.reused.length }} grupos repetidos
                            </p>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Débiles -->
            <Card v-if="report.weak.length">
                <template #title>
                    <span class="flex items-center gap-2 text-base">
                        <i class="pi pi-exclamation-triangle text-red-500" /> Débiles ({{ report.weak.length }})
                    </span>
                </template>
                <template #content>
                    <ul class="flex flex-col divide-y divide-surface-200 dark:divide-surface-700">
                        <li
                            v-for="w in report.weak"
                            :key="w.id"
                            class="flex cursor-pointer items-center justify-between py-2 hover:text-primary"
                            @click="openEntry(w.id)"
                        >
                            <span class="truncate">{{ w.title }}</span>
                            <Tag :value="WEAK_LABELS[w.score] ?? 'Débil'" severity="danger" />
                        </li>
                    </ul>
                </template>
            </Card>

            <!-- Repetidas -->
            <Card v-if="report.reused.length">
                <template #title>
                    <span class="flex items-center gap-2 text-base">
                        <i class="pi pi-clone text-amber-500" /> Repetidas ({{ report.reused.length }} grupos)
                    </span>
                </template>
                <template #content>
                    <div v-for="(group, i) in report.reused" :key="i" class="mb-3">
                        <div class="mb-1 text-xs text-surface-500">{{ group.count }} entradas comparten una contraseña:</div>
                        <div class="flex flex-wrap gap-2">
                            <Tag
                                v-for="e in group.entries"
                                :key="e.id"
                                :value="e.title"
                                class="cursor-pointer"
                                severity="warn"
                                @click="openEntry(e.id)"
                            />
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Sin contraseña -->
            <Card v-if="report.empty.length">
                <template #title>
                    <span class="flex items-center gap-2 text-base">
                        <i class="pi pi-info-circle text-surface-400" /> Sin contraseña ({{ report.empty.length }})
                    </span>
                </template>
                <template #content>
                    <div class="flex flex-wrap gap-2">
                        <Tag
                            v-for="e in report.empty"
                            :key="e.id"
                            :value="e.title"
                            class="cursor-pointer"
                            severity="secondary"
                            @click="openEntry(e.id)"
                        />
                    </div>
                </template>
            </Card>

            <div v-if="!report.weak.length && !report.reused.length" class="py-8 text-center text-surface-500">
                <i class="pi pi-check-circle mb-2 text-3xl text-green-500" />
                <p>¡Sin contraseñas débiles ni repetidas!</p>
            </div>
        </main>
    </div>
</template>
