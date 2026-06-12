/**
 * Conversiones binario ↔ base64/UTF-8 usadas por toda la capa crypto.
 */

export function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) {
        binary += String.fromCharCode(b);
    }
    return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function utf8Encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

export function utf8Decode(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

/** Sobrescribe un buffer sensible (best-effort: JS no garantiza borrado real). */
export function zero(bytes: Uint8Array): void {
    bytes.fill(0);
}
