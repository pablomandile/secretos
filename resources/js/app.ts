import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import 'primeicons/primeicons.css';

import App from '@/App.vue';
import router from '@/router';

// La bóveda depende de WebCrypto (AES-GCM, HKDF): solo existe en contextos
// seguros (https o localhost). Sin él la app no puede funcionar.
if (!window.crypto?.subtle) {
    document.getElementById('app')!.innerHTML =
        '<div style="font-family:sans-serif;max-width:40rem;margin:4rem auto;padding:2rem;border:1px solid #f00;border-radius:8px">' +
        '<h1>Contexto inseguro</h1>' +
        '<p>Esta aplicación requiere WebCrypto, disponible solo en <strong>https://</strong> o <strong>http://localhost</strong>. ' +
        'Accedé vía localhost o configurá HTTPS.</p></div>';
    throw new Error('WebCrypto (crypto.subtle) no disponible: contexto inseguro');
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark',
        },
    },
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');
