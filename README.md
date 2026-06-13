# Secretos

Gestor de contraseñas personal auto-hospedado con interfaz web y cifrado
**zero-knowledge**: todo el cifrado ocurre en el navegador y el servidor solo
almacena texto cifrado. Inspirado en KeePass2 y Dashlane, construido con
Laravel 12 + Vue 3 + PrimeVue.

## Modelo de seguridad

La contraseña maestra **nunca** sale del navegador ni se envía al servidor.

```
contraseña maestra
  │  Argon2id (salt por usuario, 64 MiB / 3 / 4)   ← hash-wasm, en el navegador
  ▼
masterKey (solo en memoria)
  ├─ HKDF "secretos/v1/auth" → verifier   → al servidor (se re-hashea con Argon2id)
  └─ HKDF "secretos/v1/wrap" → wrappingKey → solo en memoria
vaultKey (32 bytes aleatorios, generados al registrarse)
  └─ AES-256-GCM(wrappingKey) → protected_key   → guardado en el servidor
```

- Cada campo se cifra con **AES-256-GCM** (`v1.<iv>.<ciphertext>`), IV aleatorio
  por operación, prefijo de versión para migraciones futuras.
- El servidor guarda únicamente: hash del verifier, parámetros KDF + salt, la
  `vaultKey` envuelta y los items como ciphertext + metadata mínima (favorito,
  estructura de carpetas, timestamps).
- Una contraseña incorrecta falla localmente (fallo del tag GCM), sin consultar
  al servidor.
- **No hay recuperación**: si olvidás la contraseña maestra, perdés la bóveda.

## Stack

- **Backend**: Laravel 12, Sanctum (sesión cookie SPA), MySQL/MariaDB.
- **Frontend**: Vue 3 + TypeScript + Vue Router + Pinia + PrimeVue 4 (tema Aura).
- **Crypto**: `hash-wasm` (Argon2id) + WebCrypto (HKDF, AES-GCM); `zxcvbn-ts`
  para el medidor de fortaleza.

## Requisitos

- PHP 8.4+, Composer 2, Node 22+, MySQL/MariaDB (incluidos en Laragon).
- **Contexto seguro obligatorio**: WebCrypto solo existe en `https://` o
  `http://localhost`. Usá `http://localhost:8000` en desarrollo (no
  `secretos.test` por HTTP plano), o configurá HTTPS.

## Puesta en marcha

```bash
composer install
npm install
cp .env.example .env        # ya viene configurado para MySQL (BD: secretos)
php artisan key:generate

# Crear la base y migrar (con el MySQL de Laragon corriendo)
php artisan migrate

npm run build               # o `npm run dev` para HMR
php artisan serve --port=8000
```

Abrí **http://localhost:8000**, creá tu cuenta y empezá a guardar.

> Si MySQL no está corriendo en Laragon, arrancalo desde el panel de Laragon
> (o `mysqld --defaults-file=.../my.ini`).

### Login con Google (opcional)

Google **autentica** la sesión; el desbloqueo de la bóveda sigue pidiendo la clave
maestra (zero-knowledge intacto). La primera vez que entrás con Google, configurás
tu clave maestra. Para habilitarlo:

1. En [Google Cloud Console](https://console.cloud.google.com/) creá un OAuth Client ID
   (tipo "Web application").
2. Authorized redirect URI: `http://localhost:8000/auth/google/callback`.
3. Poné las credenciales en `.env`:

```
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

Sin credenciales, la app funciona igual con email + clave maestra; el botón de Google
solo aplica si configurás lo anterior.

## Tests

```bash
php artisan test     # backend (PHPUnit): auth, bóveda, versionado, cuenta
npm test             # crypto (Vitest): KDF, cifrado, jerarquía de claves, generador
npm run typecheck    # vue-tsc
```

### Reportes JSON

```bash
npm run test:report  # corre ambas suites y genera reportes JSON en reports/
```

Produce (carpeta `reports/`, ignorada por git):
- `reports/vitest.json` — resultado del frontend/crypto (Vitest también lo escribe en cada `npm test`).
- `reports/phpunit.json` — resultado del backend (convertido del JUnit XML).
- `reports/summary.json` — totales combinados + `ok`.

Scripts de verificación end-to-end contra la API viva (requieren `php artisan serve`):

```bash
npx vite-node scripts/verify-ceremony.ts          # registro/login/descifrado
npx vite-node scripts/verify-vault.ts             # CRUD de bóveda
npx vite-node scripts/verify-password-change.ts   # cambio de clave maestra
```

## Estructura

```
app/Http/Controllers   Auth, Vault, Entry, Folder, Tag, EntryVersion, Account
app/Support            EntryVersioning (snapshots de historial)
resources/js/crypto    kdf · keys · cipher · generator · strength · encoding
resources/js/stores    auth · keychain (custodia de la vaultKey) · vault
resources/js/pages     Login · Register · Unlock · Vault · Trash · Settings
resources/js/components vault/* · generator/*
```

## Funcionalidades

- Bóveda con entradas (título, usuario, contraseña, URL, notas), carpetas
  jerárquicas, etiquetas, favoritos y campos personalizados (con flag protegido).
- Búsqueda y filtros instantáneos (client-side, sobre datos descifrados).
- Generador de contraseñas (CSPRNG, charset configurable, excluir ambiguos) y
  medidor de fortaleza.
- Copiar al portapapeles con auto-limpieza a los 30 s.
- Papelera (borrado suave) e historial de versiones por entrada (estilo KeePass).
- Auto-bloqueo por inactividad y al volver de suspensión; cambio de clave maestra
  (re-envuelve la `vaultKey`, sin re-cifrar items).
- Multi-usuario con bóvedas aisladas.

## Roadmap

Hecho: TOTP (códigos 2FA), import desde KeePass (CSV), modo oscuro, login con Google.

Pendiente:
- Export de backup cifrado (en el cliente).
- Reportes de salud de contraseñas (débiles/repetidas) y chequeo de filtraciones
  vía HIBP con k-anonimato.
- Adjuntos cifrados y compartición de entradas.

## Notas de seguridad

- El JS lo sirve el propio servidor: un servidor comprometido podría servir JS
  malicioso. El modelo protege contra robo de BD/backups y snooping del hosting,
  no contra un servidor totalmente comprometido (igual que cualquier bóveda web).
- CSP estricta en producción; en local se omite para no romper el HMR de Vite.
