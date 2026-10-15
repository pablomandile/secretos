/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

// primevue no publica tipos para el bus de toasts.
declare module 'primevue/toasteventbus' {
    const ToastEventBus: { emit: (event: string, payload?: unknown) => void };
    export default ToastEventBus;
}
