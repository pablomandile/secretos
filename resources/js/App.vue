<script setup lang="ts">
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useAutoLock } from '@/services/idleLock';

// Auto-bloqueo por inactividad (activo mientras la bóveda esté desbloqueada).
useAutoLock();
</script>

<template>
    <Toast position="bottom-right" />
    <ConfirmDialog />
    <RouterView />
</template>
