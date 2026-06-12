import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useKeychainStore } from '@/stores/keychain';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', redirect: '/app' },
        {
            path: '/login',
            name: 'login',
            component: () => import('@/pages/Login.vue'),
            meta: { guest: true },
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('@/pages/Register.vue'),
            meta: { guest: true },
        },
        {
            path: '/unlock',
            name: 'unlock',
            component: () => import('@/pages/Unlock.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/app',
            name: 'vault',
            component: () => import('@/pages/Vault.vue'),
            meta: { requiresAuth: true, requiresUnlocked: true },
        },
        {
            path: '/app/trash',
            name: 'trash',
            component: () => import('@/pages/Trash.vue'),
            meta: { requiresAuth: true, requiresUnlocked: true },
        },
    ],
});

router.beforeEach(async (to) => {
    const auth = useAuthStore();
    const keychain = useKeychainStore();

    // Al primer acceso, averiguamos si hay sesión viva (sobrevive a un refresh).
    if (!auth.ready) {
        await auth.fetchSession();
    }

    const authed = auth.isAuthenticated;
    const unlocked = !keychain.isLocked;

    if (to.meta.guest && authed) {
        return unlocked ? { name: 'vault' } : { name: 'unlock' };
    }
    if (to.meta.requiresAuth && !authed) {
        return { name: 'login' };
    }
    if (to.meta.requiresUnlocked && !unlocked) {
        return { name: 'unlock' };
    }
    if (to.name === 'unlock' && unlocked) {
        return { name: 'vault' };
    }
    return true;
});

export default router;
