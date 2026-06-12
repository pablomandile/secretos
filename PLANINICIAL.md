# Plan: "Secretos" — Gestor de claves personal auto-hospedado (Laravel + Vue 3)

## Contexto

Proyecto nuevo (greenfield) en `c:\laragon\www\secretos` (directorio vacío; PHP 8.4.22, Composer 2.9.4, Node 22, MySQL en Laragon). El usuario quiere un gestor de contraseñas de uso personal con interfaz web, inspirado en KeePass2 (que usa localmente) y Dashlane (cuya versión gratuita fue eliminada en sept. 2025 — ya es solo pago). La investigación de ambos productos más Bitwarden/Vaultwarden definió el patrón a seguir: **bóveda web zero-knowledge** — todo el cifrado ocurre en el navegador y el servidor solo almacena texto cifrado.

**Decisiones confirmadas por el usuario:**
- Cifrado **zero-knowledge** (estilo Bitwarden): clave derivada en el navegador, servidor solo guarda ciphertext.
- **Multi-usuario**: cuentas independientes, cada una con su propia clave maestra y bóveda aislada.
- **MySQL/MariaDB** (Laragon).
- **Alcance MVP**: núcleo de bóveda + campos avanzados (detalle abajo). Fases futuras: TOTP, import KeePass/export, salud de contraseñas, chequeo de filtraciones (HIBP k-anonimato), adjuntos.
- Repositorio GitHub: `https://github.com/pablomandile/secretos.git` (vacío, a vincular en fase 0).

## Stack y decisiones de arquitectura

- **Laravel 12 + SPA Vue 3 con API** (no Inertia): la bóveda es un cliente con estado de larga vida que mantiene claves y datos descifrados en memoria; el servidor no puede renderizar props útiles (solo tiene ciphertext). Un solo Blade shell + Vue Router + axios.
- **Auth: Sanctum en modo cookie SPA** (sesión stateful + CSRF, sin tokens en JS). Sin starter kit (Breeze/Jetstream asumen que el servidor ve la contraseña — incompatible con zero-knowledge); controladores de auth a mano.
- **Frontend**: PrimeVue 4 (tema Aura) + Pinia + TypeScript en `resources/js`.
- **Crypto en navegador**:
  - `hash-wasm` para **Argon2id** (WASM inlined en base64 → cero config de Vite; preferido sobre `argon2-browser`).
  - **WebCrypto** nativo para HKDF-SHA256, AES-256-GCM y `getRandomValues`.
  - `@zxcvbn-ts/core` para medidor de fortaleza (lazy-load).
  - `@vueuse/core` para `useIdle` (auto-bloqueo).
- Tests: Vitest (capa crypto) + Pest (API).

## Diseño criptográfico

```
claveMaestra (nunca sale del navegador)
  │ Argon2id(salt 16B aleatorio por usuario, mem=64MiB, iter=3, par=4) → 32B
  ▼
masterKey (solo memoria)
  ├─ HKDF info="secretos/v1/auth" → verifier (se envía al servidor, que lo re-hashea con Hash::make argon2id)
  └─ HKDF info="secretos/v1/wrap" → wrappingKey (solo memoria)
vaultKey = 32B aleatorios generados al registrarse
  → envuelta con wrappingKey → blob `protected_key` guardado en servidor
  → al desbloquear se importa como CryptoKey NO extraíble en Pinia
```

- **Formato de ciphertext**: `v1.<base64(iv 12B)>.<base64(ct||tag)>` — AES-256-GCM, IV aleatorio por operación, prefijo de versión para migraciones futuras (v2 reservará AAD = id de entrada + nombre de campo contra ciphertext-swapping).
- Contraseña incorrecta al desbloquear = fallo del tag GCM al desenvolver `protected_key` — sin round-trip al servidor.
- **Cambio de clave maestra** = solo re-envolver `vaultKey`; nunca se re-cifran los items.

## Esquema de base de datos

PKs ULID en folders/entries/tags. Lo que NUNCA va en texto plano: clave maestra (nunca se transmite), claves, título/usuario/contraseña/URL/notas, labels y valores de campos personalizados, nombres de carpetas y etiquetas. Metadata en texto plano aceptada (igual que Bitwarden): email, params KDF/salt, timestamps, flag favorito, estructura del árbol de carpetas, estado de borrado.

- **`users`**: email, name, `password` (hash Argon2id del *verifier*, no de la clave maestra), `kdf_type/memory/iterations/parallelism`, `kdf_salt`, `protected_key` (ciphertext), `key_version`, `auto_lock_minutes`.
- **`folders`**: ulid, user_id, parent_id (árbol), `name` (ciphertext), position.
- **`entries`**: ulid, user_id, folder_id, `type` (1=login; reservados 2=nota, 3=tarjeta), `title/username/password/url/notes` (todos ciphertext), `favorite` (plaintext), `deleted_at` (soft delete = papelera).
- **`custom_fields`**: entry_id, `label`/`value` (ciphertext), `type` (1=texto, 2=protegido; reservado 3=totp), `protected` (flag), position.
- **`tags`** (`name` ciphertext, `color` plaintext) + pivote `entry_tag`.
- **`entry_versions`**: snapshot de columnas ciphertext + `custom_fields` JSON, `version` monotónico por entrada. **Mecanismo clave**: un `EntryObserver::updating()` copia la fila actual antes de aplicar el update — el servidor versiona sin poder leer nada (todo está cifrado bajo la vaultKey inmutable). Poda a N=20 versiones. Saltar snapshot cuando solo cambia metadata plaintext (toggle de favorito).

## API (routes/api.php, Sanctum, throttle en auth)

**Auth en dos pasos (zero-knowledge):**
- `POST /api/auth/prelogin` `{email}` → params KDF + salt. **Anti-enumeración**: para emails desconocidos devolver salt falso determinístico `HMAC(APP_KEY, email)`.
- `POST /api/auth/register` `{email, name, kdf_*, kdf_salt, verifier, protected_key}`.
- `POST /api/auth/login` `{email, verifier}` → `{user, protected_key, kdf_*}` + cookie de sesión.
- `GET /api/auth/session` → datos para la pantalla de desbloqueo tras un refresh (sesión viva, claves perdidas; el desbloqueo es 100% local).
- `POST /api/auth/logout`.

**Bóveda:**
- `GET /api/vault` → payload bootstrap `{folders, tags, entries}` en un round-trip.
- `POST/PUT /api/entries[/{id}]` (validar ciphertext con regex `^v\d+\.…`), `PATCH` para metadata (favorito/mover), `DELETE` (soft) / `?force=1` (purgar), `POST .../restore`.
- `GET /api/entries/{id}/versions[/{vid}]` + `POST .../restore`.
- CRUD `folders` y `tags`.
- `PUT /api/account/master-password` `{current_verifier, verifier, kdf_salt, kdf_*, protected_key}` + invalidar otras sesiones.

FormRequests + API Resources + Policies en todos los modelos (aislamiento entre usuarios por policy Y por crypto).

## Estructura frontend

```
resources/js/
├─ crypto/   kdf.ts · keys.ts · cipher.ts · generator.ts · strength.ts
├─ stores/   auth.ts · keychain.ts (núcleo de seguridad) · vault.ts
├─ services/ api.ts (axios+CSRF+interceptor 401) · idleLock.ts · clipboard.ts
├─ pages/    Login · Register · Unlock · Vault · Trash · Settings
└─ components/vault/  EntryTable · EntryDialog · EntryViewPanel · CustomFieldsEditor
              FolderTree · TagPicker · VersionHistoryDialog · PasswordGenerator · StrengthMeter
```

- **`keychain.ts`**: `unlock()` deriva → desenvuelve → importa CryptoKey no extraíble → `fill(0)` de buffers transitorios. `lock()` = null + `vault.$reset()` + redirect `/unlock`. **Jamás persistir este store.**
- **`vault.ts`**: descifra todo al desbloquear; búsqueda/filtros/orden client-side; mutaciones cifran y luego llaman a la API (optimistic con rollback).
- **Guards de router**: `/login|/register` (guest) · `/unlock` (sesión sin claves) · `/app/*` (sesión + desbloqueado).
- **Auto-bloqueo**: `useIdle(auto_lock_minutes)` + chequeo de timestamp en `visibilitychange` (los timers no corren con la laptop suspendida).
- **Portapapeles**: copiar → toast con cuenta regresiva → a los 30s sobrescribir si no cambió (best-effort, igual que Bitwarden web).
- **Generador**: `getRandomValues` con rejection sampling (sin sesgo de módulo); opciones de charset, longitud, excluir ambiguos; medidor zxcvbn.
- **PrimeVue**: DataTable (lista de entradas, filtro global, virtual scroll), Tree (carpetas), Dialog (editar entrada / generador / historial con Timeline), Drawer (vista rápida con botones copiar), AutoComplete múltiple (tags), Toast/ConfirmDialog/Menubar.

## Ceremonia de registro (resumen)

Cliente: validar fortaleza (zxcvbn ≥3 + advertencia "sin recuperación posible") → generar `kdf_salt` → Argon2id → HKDF (verifier + wrappingKey) → generar `vaultKey` aleatoria → envolverla → POST register → cero en buffers → entrar desbloqueado. Servidor: validar formatos y límites de params KDF, `Hash::make(verifier)`, login + regenerar sesión.

## Fases de implementación (cada una verificable)

| # | Hito | Verificación |
|---|---|---|
| 0 | Scaffold: Laravel 12 + `install:api` + Vue/Vite/PrimeVue/TS + BD `secretos` + config Sanctum stateful. **Git**: `git init`, vincular remote `https://github.com/pablomandile/secretos.git` (repo vacío existente), commit inicial y push a `main`. Verificar que `.gitignore` excluya `.env` y `node_modules`/`vendor` | Página PrimeVue renderiza en `http://localhost:8000`; `git remote -v` muestra el repo y el push inicial aparece en GitHub |
| 1 | **Núcleo crypto headless** (`crypto/*.ts`) + suite Vitest: round-trips, separación HKDF, wrap/unwrap, tamper→throw, generador | `npx vitest` verde — fundación antes de cualquier UI |
| 2 | Auth + ceremonia: migración users, controladores prelogin/register/login/session, páginas Login/Register/Unlock, keychain, guards | En BD solo hash/salt/blob; refresh→unlock; clave errónea = error GCM local |
| 3 | Capa de datos: migraciones folders/entries/custom_fields/tags, modelos, policies, CRUD, `GET /api/vault`, tests Pest (aislamiento, formato ciphertext) | `php artisan test` verde |
| 4 | UI de bóveda: pipeline de descifrado, DataTable, FolderTree, EntryDialog, copiar con auto-limpieza, favoritos, tags | CRUD manual completo; MySQL muestra solo ciphertext |
| 5 | Generador + medidor de fortaleza | Opciones respetadas; excluir ambiguos funciona |
| 6 | Papelera + historial de versiones (Observer + VersionHistoryDialog + restaurar) | Editar 3× → 3 versiones descifrables; restaurar |
| 7 | Hardening: auto-bloqueo, botón de bloqueo, cambio de clave maestra, throttles, CSP, scrubbing de `verifier` en logs | Idle → bloqueado; cambio de clave → items intactos |
| 8 | Stubs futuros: columnas `type` reservadas, esqueletos import/export (501), dispatch por `key_version` | Revisión de esquema |

Al completar cada hito se hace commit y push al repositorio de GitHub, de modo que el historial refleje los hitos verificables.

## Riesgos y mitigaciones

1. **WebCrypto exige contexto seguro**: `secretos.test` por HTTP plano NO sirve (`crypto.subtle` undefined). Desarrollar en `localhost` (`php artisan serve`) o activar SSL de Laragon y confiar el certificado. Guard en `app.ts` que muestre error si falta `crypto.subtle`. Producción = HTTPS obligatorio.
2. **Clave maestra olvidada = pérdida total** (por diseño). Mitigar: advertencia explícita al registrarse, y priorizar export cifrado en la fase 2 del roadmap.
3. **JS no puede borrar memoria de verdad**: mitigación best-effort — CryptoKey no extraíble, `fill(0)` en buffers, nada en localStorage/URLs. Misma postura que Bitwarden web.
4. Columnas ciphertext en `TEXT`/`MEDIUMTEXT` (base64 infla ~33%).
5. Interceptor 401 de axios debe llamar `keychain.lock()` antes de redirigir.
6. Nada de Telescope/Debugbar en producción; `verifier` excluido de logs.

## Verificación end-to-end del MVP

1. `npx vitest` (crypto) y `php artisan test` (API) verdes.
2. Registrar usuario → inspeccionar MySQL: solo hash del verifier, salt, `protected_key` y ciphertexts `v1.…` — ninguna contraseña legible.
3. Crear/editar/borrar entradas con carpetas, tags, campos personalizados y favoritos; búsqueda instantánea client-side.
4. Refresh → pantalla de desbloqueo; clave errónea falla localmente; idle 5 min → bloqueo automático.
5. Segundo usuario en otro navegador: bóvedas completamente aisladas.
6. Editar una entrada varias veces → historial descifrable → restaurar versión anterior.
7. Cambiar clave maestra → re-login con la nueva, items intactos, sesiones viejas invalidadas.
