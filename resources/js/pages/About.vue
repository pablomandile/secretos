<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';

import AppLogo from '@/components/AppLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const EMAIL = 'pablo.mandile@gmail.com';
const WEBSITE = 'https://bioinfo.pablomandile.com.ar/pablo';

// La página es pública: se llega desde la bóveda o desde el login, así que el
// botón de volver apunta a donde tenga sentido según haya sesión o no.
const backTo = computed(() => (auth.isAuthenticated ? { name: 'vault' } : { name: 'login' }));
</script>

<template>
    <div class="flex min-h-screen flex-col bg-surface-50 dark:bg-surface-950">
        <header class="flex items-center gap-3 border-b border-surface-200 px-4 py-2 dark:border-surface-700">
            <Button icon="pi pi-arrow-left" text rounded aria-label="Volver" @click="router.push(backTo)" />
            <span class="flex items-center gap-2 font-semibold"><i class="pi pi-info-circle" /> Acerca de</span>
            <div class="ml-auto"><ThemeToggle /></div>
        </header>

        <main class="mx-auto w-full max-w-2xl p-4">
            <Card>
                <template #content>
                    <AppLogo class="mb-6 w-52" />

                    <p class="text-lg leading-relaxed text-surface-700 dark:text-surface-200">
                        Gestor de contraseñas personal con cifrado de extremo a extremo: la clave maestra nunca
                        sale de tu navegador y el servidor solo guarda texto cifrado.
                    </p>

                    <ul class="mt-6 flex flex-col gap-3 text-sm text-surface-600 dark:text-surface-300">
                        <li class="flex items-start gap-2">
                            <i class="pi pi-lock mt-0.5 text-primary" />
                            <span>
                                Cifrado <strong>zero-knowledge</strong>: Argon2id para derivar la clave y
                                AES-256-GCM por campo, todo en el navegador.
                            </span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="pi pi-mobile mt-0.5 text-primary" />
                            <span>Códigos TOTP, generador de contraseñas y análisis de salud de la bóveda.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="pi pi-sync mt-0.5 text-primary" />
                            <span>Importación y exportación compatible con KeePass 2 (CSV y XML).</span>
                        </li>
                    </ul>

                    <div class="mt-8 border-t border-surface-200 pt-6 dark:border-surface-700">
                        <p class="text-xs font-bold uppercase tracking-wider text-surface-500">Creado por</p>
                        <p class="mt-1 text-lg font-semibold text-surface-900 dark:text-surface-0">Pablo Mandile</p>

                        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
                            <a
                                :href="`mailto:${EMAIL}`"
                                class="inline-flex items-center gap-2 text-sm text-surface-600 transition-colors hover:text-primary dark:text-surface-300"
                            >
                                <i class="pi pi-envelope shrink-0" />
                                <span class="break-all">{{ EMAIL }}</span>
                            </a>

                            <a
                                :href="WEBSITE"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-2 text-sm text-surface-600 transition-colors hover:text-primary dark:text-surface-300"
                            >
                                <i class="pi pi-globe shrink-0" />
                                <span>Bioinfo</span>
                            </a>
                        </div>
                    </div>
                </template>
            </Card>
        </main>
    </div>
</template>
