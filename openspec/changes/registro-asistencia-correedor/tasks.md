# Tasks — Registro de asistencia del corredor por QR

> **Precondición:** el backend ya tiene el `POST /attendance/team/:team_id/session/:training_session_id`
> y el QR **ya emite la URL del frontend** (commit `9c0dfe5` en `paceron-backend`, rama
> `feature/gestion-asistencia-entrenador`). El PR #89 sigue sin mergear: para **probar de
> punta a punta** hace falta ese backend corriendo; para **desarrollar** la UI alcanza con
> mocks.

Contexto de ejecución:
- `npm test` (Jest, lógica pura) y `npm run lint` en verde. Lint con las 3 reglas locales.
- Rama desde `develop`, bump de versión **menor** en `package.json` en esta misma PR.
- Stagear solo rutas explícitas. No push/merge (lo hace el usuario).
- `expo-camera` es un módulo **nuevo**: el dev client hay que regenerarlo (R1).

## Etapa 0 — Dependencia y asset

- [x] **0.1** `npx expo install expo-camera` (versión del SDK 54). Anotar en el commit que el dev client hay que regenerarlo.
- [x] **0.2** `app.config.js`: agregar `android.permissions: ["CAMERA"]` (R2). Sin esto el pedido en runtime falla en Android 13+.
- [x] **0.3** 🚦 **GATE** `npx expo export -p web` sin errores (mismo build de Vercel).
- [x] **0.4** Copiar `paceron-runner-waiting.gif` a `assets/`. **Verificar que el archivo en el repo pese lo mismo que el de `/tmp`** y que tenga la duración de ~1,2 s por vuelta.
- [x] **0.5** `npm test` + `npm run lint` en verde.

## Etapa 1 — Ruta y navegación

- [x] **1.1** `app/attendance/register.jsx`: wrapper mínimo de la ruta `/attendance/register`, auto-descubierta por Expo Router, **sin** `.web.jsx`.
- [x] **1.2** `routes/catalog.js`: agregar `checkinRoute` (`name: 'checkin'`, `label: 'Registrar asistencia'`, `href: '/attendance/register'`, `icon: 'qrcode-scan'`, `role: 'runner'`, `mobileOnly: true`).
- [x] **1.3** `getRoutesByRole`: filtrar `mobileOnly` con `isMobile` de `utils/platform.js`. Actualizar el comentario de la función, que hoy solo documenta la regla de `role`.
- [x] **1.4** `__tests__/routes.catalog.test.js`: la ruta aparece para `runner` en mobile y **no** en web; **no** aparece nunca para `trainer`, en ninguna plataforma.
- [x] **1.5** `npm test` + `npm run lint` en verde.

## Etapa 2 — Servicio y parsing

- [x] **2.1** `utils/checkin-qr-url.js` + test: `parseCheckinQrPayload(text)` → `{ teamId, sessionInstanceId }` o `null`. Acepta la URL del QR (`<frontend>/attendance/register?team_id=&session_instance_id=`, con o sin query extra, con o sin barra final, con http/https, con query en otro orden). Rechaza: texto que no es URL, URL de otro host, URL nuestra de otra ruta, y URL sin alguno de los dos ids. IDs como **string**, sin castear: el comparador es `isSameId`.
- [x] **2.2** `services/attendance.js`: `registerCheckin({ teamId, sessionInstanceId })` → `POST /attendance/team/{teamId}/session/{sessionInstanceId}` con `Number()` en ambos ids (regla del `CLAUDE.md` sobre ids del roster). Guard de `USE_MOCKS` primero, comentario `// POST /api/v1/...` arriba.
- [x] **2.3** `services/__mocks__/attendance-mock.js`: el mock de registro, con los tres casos (201 / 200 / 403) y una latencia artificial de ~900 ms para poder ver el overlay de espera.
- [x] **2.4** `npm test` + `npm run lint` en verde.

## Etapa 3 — Store de intención pendiente

- [x] **3.1** `store/checkin-store.js`: `pendingCheckin` (`{ teamId, sessionInstanceId } | null`), `setPendingCheckin`, `clearPendingCheckin`. Mismo patrón que `store/session-runtime-store.js#pendingSession`.
- [x] **3.2** La pantalla, al detectar que no hay sesión, escribe el pendiente y redirige a `/login`. Al montar con sesión presente, si hay pendiente, lo consume y arranca el registro.

## Etapa 4 — Pantalla y overlay

- [x] **4.1** `components/checkin/checkin-screen.jsx`: máquina de fases `scanning` → `submitting` → `result` (D8). `scanning` monta la cámara; `submitting` el overlay; `result` el mensaje + ACEPTAR.
- [x] **4.2** Permiso de cámara: pedirlo en runtime al montar `scanning`. Denegado → mensaje explicando que hace falta permiso, con acción para abrir ajustes del sistema.
- [x] **4.3** Escaneo: `onBarcodeScanned` con guarda de request en vuelo (requisito 2 — un escaneo no dispara dos POSTs).
- [x] **4.4** `components/checkin/checkin-waiting-overlay.jsx`: fondo `#979597` — el gris del asset optimizado, **medido del archivo**, D4/R3, la animación con `Image` + `paceron-runner-waiting.gif`, y debajo "Registrando asistencia". `nativeID`+`testID` en todo. Sin `Modal` propio: es una capa absoluta sobre la pantalla, para no anidar dos superficies nativas.
- [x] **4.5** `components/checkin/checkin-result.jsx`: check verde / X roja + mensaje + botón ACEPTAR. Iconos de `MaterialCommunityIcons` **verificados contra el glyphmap instalado** (mismo criterio que el bug de `sort-alpha-ascending`).
- [x] **4.6** Aviso de plataforma y de rol (requisitos 1 y 6): web → "solo en la app"; rol no corredor → aviso. Sin montar la cámara.
- [x] **4.7** `npm run lint` en verde.

## Etapa 5 — Integración y verificación

- [ ] **5.1** Recorrido en device: escanear → overlay → resultado verde → ACEPTAR → volver a escanear. Con el dev client regenerado.
- [ ] **5.2** Recorrido sin sesión: entrar al escáner sin loguearse → login → **el registro continúa solo**, sin volver a escanear.
- [ ] **5.3** Errores: 403, 400, 404 y error de red, cada uno con su mensaje y su icono.
- [ ] **5.4** Denegar el permiso de cámara → mensaje + acción de ajustes.
- [x] **5** `npm test` completo + `npm run lint` en verde.
- [x] **6** `CLAUDE.md`: nota con (a) que el QR es una URL y por qué no un payload, (b) que el asset de la animación es bicromático y no se le quita el fondo, (c) que App Links quedó fuera a propósito y por qué reincorporarlo es barato.
- [x] **7** Commit por etapa, subject en inglés y cuerpo en español si el "por qué" no es obvio del diff. **Sin push/merge.**

## Notas de la verificación en web

La etapa 4 se puede verificar casi entera en el preview **salvo la cámara**: en web la
pantalla no monta la cámara (requisito 6) y muestra el aviso de plataforma. El overlay y el
resultado sí se pueden ver forzando la fase con mocks, que es lo que habilita el mock con
latencia de 2.3. El escaneo real, el permiso y el deep link de cámara **requieren device**.
