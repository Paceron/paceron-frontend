# Proposal — Gestión de asistencia desde el panel del entrenador

## Why

El backend ya tiene los tres endpoints base de asistencia (generar QR, registrar
alta, buscar) desde el change `add-qr-attendance`, pero **el frontend no tiene ni
una línea de código de asistencia**: no hay `services/attendance.js`, ni hook, ni
pantalla, ni mock. La única referencia en todo el repo es copy de marketing
(`components/home/landing-content.js:33-37`, la tarjeta "Asistencia QR" del
landing) y la feature flag `canScanQR` en `utils/platform.js:13`, que no la
consume ninguna ruta.

El efecto para el usuario es concreto: el entrenador que termina de dar una
sesión presencial no tiene forma de cerrar la asistencia. No puede ver quién
asistió, no puede cargar a los que marcó, no puede corregir un error borrando
una fila, y el único endpoint de QR que existe (que sí funciona) es inalcanzable
desde la app. Todo el módulo es, hoy, backend sin consumidor.

Este change construye el lado entrenador de ese módulo y es el gemelo de
`gestion-asistencia-entrenador` en `paceron-backend`, que define el contrato de
los 4 endpoints nuevos (más el `GET /qr` existente) que esta pantalla consume.

## What Changes

- **Pantalla `/attendance`** (`components/attendance/attendance-screen.jsx`),
  nueva y **solo para entrenador** (`role: 'trainer'` en `routes/catalog.js`).
  Acepta deep-link opcional `?team_id=&session_instance_id=`; sin params arranca
  con los selectores vacíos.
- **Cascada de 3 selectores con búsqueda**: Equipo → Grupo → Sesión. Los tres
  permiten **escribir para filtrar** y elegir de una lista, que es lo pedido
  explícitamente. `ResponsiveSelectField` **no** sirve para esto: tanto el
  `<select>` web como el `PickerField` móvil listan todas las opciones sin
  filtro (`components/forms/fields.jsx:93-97` y `:619-679`), así que hace falta
  un componente nuevo. Al elegir equipo, el grupo **se preselecciona con el
  primero** del equipo.
- **Tarjetas de métricas** al tope de la grilla: asistentes, no confirmados y %
  de asistencia confirmada, con el roster del grupo como denominador.
- **Grilla de asistencia** con el roster del grupo y el estado de cada corredor.
  Cada fila tiene un **check que se marca para habilitar la edición**, y un único
  botón "Guardar cambios" que persiste **todas** las filas marcadas en una sola
  operación.
- **Borrado individual** por fila, con modal de confirmación.
- **QR de la sesión**: botón que pide el QR al endpoint existente y lo muestra en
  un modal, con acciones de **descargar PDF** y **compartir** (hoja de
  compartir nativa) y un atajo de **compartir por WhatsApp**.
- **PDF del QR generado en el cliente** con `expo-print`, a partir de una
  plantilla HTML con diseño propio: logo de la app, nombre del equipo, nombre y
  fecha de la sesión, horario y lugar, y el QR centrado.
- **Extracción de dos componentes compartidos** que hoy están duplicados como
  código privado: `StatTile` (vivo dentro de `team-detail-screen.jsx:94-110` con
  ids hardcodeados a `team-detail-`, por lo que no es reutilizable) y el shell
  del modal destructivo (copiado ~4 veces, ver `components/team/delete-team-modal.jsx`).
- **4 dependencias nuevas** + 1 explícita: `expo-print`, `expo-sharing`,
  `expo-linear-gradient` y `expo-file-system` se instalan nuevas; `expo-asset` ya
  está como transitiva de `expo` y se agrega explícita porque se importa directo
  (convención de pines del repo).

## Capabilities

### New Capabilities

- `attendance-management`: la pantalla de gestión de asistencia del entrenador
  — cascada de selección de equipo/grupo/sesión presencial ocurrida, tarjetas de
  métricas, grilla de asistencia con edición masiva y borrado individual, y el
  modal de QR con generación de PDF yoptions de compartir.

### Modified Capabilities

- (ninguna — `openspec/specs/` está vacío en este repo; es la primera capability)

## Impact

**Código nuevo:**

- `services/attendance.js` + `services/__mocks__/attendance-mock.js` — 5 funciones
  siguiendo la forma de `services/workoutFeedback.js` (el precedente más cercano:
  recurso hijo de escritura de una sesión).
- `hooks/use-attendance.js` — `useAttendanceSessions`, `useSessionAttendance`,
  `useSaveAttendance`, `useDeleteAttendance`, siguiendo el **patrón C** de
  `hooks/use-session-feedback.js` (mutaciones que dejan propagar el error, para
  que la UI pueda distinguir un `403` de un `422` y mostrar el mensaje real).
- `components/attendance/attendance-screen.jsx` — pantalla principal.
- `components/attendance/attendance-row.jsx` — fila con check de edición.
- `components/attendance/attendance-metric-cards.jsx` — tarjetas + anillo de %.
- `components/attendance/attendance-qr-modal.jsx` — modal del QR.
- `components/attendance/attendance-qr-pdf.js` — plantilla HTML + `expo-print`.
- `utils/attendance-qr-share.js` — `expo-sharing` + deep link de WhatsApp.
- `components/forms/searchable-picker-field.jsx` — selector con búsqueda, reutilizable.
- `components/shared/stat-tile.jsx` — extraído de `team-detail-screen.jsx`.
- `components/shared/confirm-destructive-modal.jsx` — extraído de `delete-team-modal.jsx`.
- `app/(tabs)/attendance.jsx` + entrada `attendanceRoute` en `routes/catalog.js`.

**Código modificado:**

- `package.json` — 4 dependencias nuevas (`expo-print`, `expo-sharing`,
  `expo-linear-gradient`, `expo-file-system`) + `expo-asset` explícita. Bump de
  versión menor.
- `components/team/team-detail-screen.jsx` — pasa a importar el `StatTile`
  compartido (el de ahora tiene los ids atados a `team-detail-`).
- `__tests__/routes.catalog.test.js` — bloque nuevo para la ruta de entrenador.
- `CLAUDE.md` — anotación de la decisión de sharing/PDF y del componente
  `SearchablePickerField` (es el patrón nuevo para selects con búsqueda).

**Dependencias nuevas** — las cuatro se instalan con `npx expo install` (versiones
alineadas al SDK), pero **el proyecto ya no usa Expo Go** (desde `feature/location-picker` usa dev client
custom por `@maplibre`), así que **hay que regenerar el dev client**
(`npm run android:run`) para que los módulos nativos estén linkeados en el APK.
Eso no bumpea `runtimeVersion` (no hay cambio de versión de Expo SDK).

**Contrato externo:** este change **no define** la API, la consume. Depende de
`gestion-asistencia-entrenador` en `paceron-backend`; si ese change no está
mergeado, esta pantalla no tiene de dónde leer datos. Orden: backend primero.
