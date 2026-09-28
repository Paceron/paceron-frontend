# Design — Gestión de asistencia desde el panel del entrenador

## Context

Estado actual relevante (el *why* está en `proposal.md`):

- **No existe código de asistencia en el front.** Cero servicios, cero hooks,
  cero componentes. El módulo es enteramente backend hoy.
- La API que esta pantalla consume la define el change gemelo
  `gestion-asistencia-entrenador` en `paceron-backend`. Los 5 endpoints que se
  consumen acá — 4 nuevos más el `GET /qr` existente — y sus códigos de error
  (403 / 404 / 422) están especificados allí.
- **No hay componente de métricas reutilizable.** Existe un `StatTile` privado
  dentro de `components/team/team-detail-screen.jsx:94-110`, pero sus `nativeID`
  están hardcodeados con prefijo `team-detail-`, así que no se puede reutilizar
  tal cual.
- **No hay modal destructivo genérico.** `CLAUDE.md` referencia "el patrón visual
  de los modales de confirmación destructiva", pero no existe: hay 4 copias
  domain-local de ~70 líneas (la más limpia, `components/team/delete-team-modal.jsx`).
- **No hay selector con búsqueda.** `ResponsiveSelectField` es un switch de 10
  líneas; `SelectField` (web) mapea `options` directo a `<option>`
  (`forms/fields.jsx:93-97`) y `PickerField` (móvil) es un `Modal` + `ScrollView`
  sin filtro (`forms/fields.jsx:619-679`). Ninguno de los dos acepta texto.
- El patrón de cascada Equipo → Grupo ya existe, pero con selects **sin búsqueda**
  y con el sentinela `"Todos los equipos"` como valor (`administered-calendar-screen.jsx:151-176`).
- El patrón de lista con filtro local por `TextInput` sí existe:
  `components/team/athlete-picker-modal.jsx:11-29`.
- Las mecánicas de selección múltiple ya existen en el catálogo de ejercicios:
  `selectionMode` + `Set` de ids + check por fila + contador en el header
  (`components/plans/exercises-catalog-tab.jsx:112-136`, `:186-188`).
- `useFormDirty` + `useUnsavedChangesGuard` + `DiscardChangesModal` son
  convención obligatoria para forms que editan un recurso real (`CLAUDE.md`), y
  `usePullToRefresh` para pantallas listables. Esta pantalla es las dos cosas.
- Deps: `react-native-svg@15.12.1` y `expo-image@~3.0.11` ya están;
  `expo-print`, `expo-sharing`, `expo-linear-gradient` y `expo-file-system` **no**
  (verificado contra `node_modules`); `expo-asset@12.0.13` sí está, pero solo
  como transitiva de `expo`.
- El proyecto **no usa Expo Go** (usa dev client custom por `@maplibre`), así
  que cualquier módulo nativo nuevo exige regenerar el dev client.
- Reglas de lint activas que condicionan el diseño: `local/require-native-id`
  (todo `View`/`Text`/`Pressable`/`Modal`/… necesita `nativeID` + `testID`),
  `local/no-direct-select-field` (fuera de `components/forms/`, nadie importa
  `SelectField`/`PickerField` directo) y `local/require-modal-backdrop-close`
  (todo `Modal` con backdrop necesita `onPress` en el elemento `-backdrop`).

## Goals / Non-Goals

**Goals:**

- Cero requests por corredor: la grilla, los nombres y los totales salen del
  endpoint único de grilla.
- Que el guardado masivo sea **un** request, no uno por fila.
- Que el PDF se genere **en el cliente** con control total del diseño, sin
  depender de un endpoint de PDF en el backend.
- Reutilizar los patrones que ya existen (cascada, selección, guard, pull-to-
  refresh, modal) en vez de inventar variantes.
- Dejar la pantalla usable en cualquier viewport sin branching por plataforma.

**Non-Goals (límites de diseño):**

- No se implementa escaneo de QR por el corredor (otra sesión, según lo acordado).
- No se implementa historial de asistencias ni comparación entre sesiones.
- No se toca `GET /attendance/search` ni ningún otro cliente del backend.
- No se explica la lógica de negocio en el front: los aggregate, la autorización
  y los mensajes de error del servidor son la fuente de verdad. El front decide
  solo *cómo mostrar*.

## Decisions

### D1 — `SearchablePickerField`: un componente nuevo, no un parche sobre `ResponsiveSelectField`

El requerimiento "escribir el nombre y que se seleccione" no lo cubre ningún
campo existente. Se agrega `components/forms/searchable-picker-field.jsx`:
un trigger + un `Modal` con un `TextInput` de filtro arriba y la lista filtrada
abajo, siguiendo la forma de `athlete-picker-modal.jsx:11-29`.

Va en `components/forms/` **a propósito**: es lo que permite que el resto del
repo lo use sin violar `local/no-direct-select-field` (esa regla solo perdona a
`components/forms/`), y evita que cada pantalla que necesite buscar tenga que
reimplementar un modal.

**Por qué no extender `PickerField`**: es un componente de 120 líneas usado por
todos los forms de creación/edición del proyecto (grupos, equipos, planes,
suscripción). Agregarle un modo de búsqueda opcional le cambiaría el
comportamiento por defecto de ~15 call sites. Un componente aparte es aditivo y
reversible.

**Por qué no un `AnimatedDropdown`**: `CLAUDE.md` documenta que se ancla al
ancestro posicionado más cercano mientras `measureInWindow` devuelve coordenadas
de pantalla — se desalinea en cuanto el trigger está anidado. Un modal no tiene
ese problema.

**El filtro ignora acentos y mayúsculas** porque el equipo se elige escribiendo
un nombre propio ("Club Sur"), y en español eso falla constantemente sin
normalizar. Se implementa con `String.prototype.normalize('NFD')` +
`/[\u0300-\u036f]/g`, que es puro y testeable — entra en `__tests__/`.

Un solo componente sirve para los tres selectores; cambia lo que se muestra en la
opción (fecha + conteo en sesiones) vía un prop `renderOptionMeta`.

### D2 — La ruta es un tab de primer nivel, no una pantalla anidada bajo el equipo

`app/(tabs)/attendance.jsx` + `attendanceRoute` con `role: 'trainer'` en
`routes/catalog.js`.

`app/(tabs)/_layout.jsx:41-54` ya resuelve el shell (web ancho / web angosto /
mobile) a partir del viewport, así que la pantalla nueva hereda el comportamiento
responsive **gratis** y sin `.web.jsx`. Eso es exactamente lo que exige la regla
de "responsive web" del `CLAUDE.md`.

Se descartó anidarla bajo `/teams/[id]/...` porque los tres selectores (equipo →
grupo → sesión) son estado **de la pantalla**, no del equipo: obligaría a
duplicar la pantalla o a pelear contra la navegación existente.

### D3 — La grilla usa un endpoint único, no roster + búsqueda por separado

`GET /attendance/session/:session_instance_id?team_id=&group_id=` devuelve filas
**y** `summary` en la misma respuesta (spec del backend, requirement 2). El hook
`useSessionAttendance` expone `{ rows, summary, isLoading, error, refetch }` y
el componente deriva de `summary` las tres tarjetas.

La alternativa (componer con `useTeamRoster` + `useAttendanceSearch` en el
cliente, cruzando por `userId` en un `useMemo`) se descartó: obliga a dos queries
parciales que se desincronizan entre sí, y el cruce es exactamente el trabajo que
ya hace el `LEFT JOIN` del backend.

**Consecuencia deliberada**: esta pantalla **no** usa `use-team-roster.js`. Ese
hook sigue siendo el dueño del roster en el resto de la app; acá se usa el
endpoint de grilla, que además trae el `source` de cada asistencia y que el
roster no tiene. Es una duplicación *intencional* de fuente, no un descuido —
queda anotado para que nadie los "unifique" después.

**Las dos listas tampoco tienen por qué coincidir en cantidad, y está bien.** El
backend filtra la grilla por la ventana de membresía **en la fecha de la sesión**
(D7 de su design), mientras que el roster de la pantalla de equipo ignora
`date_end`. Consecuencia visible: un corredor que dejó el grupo después de la
sesión aparece en la grilla (correcto: era miembro ese día) y puede no aparecer
en el roster. La pantalla **no** tenta "arreglar" esa diferencia, y el frontend
no debe intentar deducir la membresía por su cuenta. El `name` de cada fila lo
compone el backend con la misma regla que el roster
(`${name} ${surname}` recortado, fallback a email), así que la búsqueda por
nombre de `SearchablePickerField` ordena igual que el roster.

### D4 — Las mutaciones usan el patrón C (dejan propagar el error)

`hooks/use-session-feedback.js:61-84` (patrón C) en vez del patrón B
(`{success, error}`), que usan `use-groups.js` y `use-teams.js`.

Motivo concreto: el backend de este módulo devuelve **422 con un mensaje
específico** ("el corredor 999 no es miembro del grupo") que la pantalla tiene
que poder mostrar. El patrón B aplana el error a `error.message` de string y
descarta `error.status`, que es justo lo que se necesita para distinguir un 403
("no sos entrenador") de un 422 ("la sesión ya no es presencial") y no mostrar un
"algo salió mal" inútil en el caso equivocado.

`onSuccess` invalida por prefijo (`['attendance', teamId, groupId, sessionId]`)
para que muera también cualquier entrada hermana del cache.

### D5 — El estado de "filas marcadas" es un `Set` en la pantalla, no en el cache de Query

`selectedIds: Set<string>` en `useState` del componente, con `onToggleSelected(id)`
por fila — el patrón ya establecido en `exercises-catalog-tab.jsx:186-188`.

No va en el cache de TanStack Query porque **no es estado de servidor**: son
ediciones locales sin persistir, y meterlas en el cache haría que un `refetch`
(caso del pull-to-refresh) tuviera que decidir si las pisa o las preserva. Como
`useState` del componente, un `refetch` no las toca y el guard de cambios sin
guardar sigue funcionando sin caso especial.

### D6 — Métricas: `StatTile` extraído + un anillo de progreso en SVG

`StatTile` se extrae de `team-detail-screen.jsx:94-110` a
`components/shared/stat-tile.jsx` con un prop `idPrefix` (el original hardcodea
`team-detail-` en los `nativeID`, que es justamente lo que impide reutilizarlo).
`team-detail-screen.jsx` pasa a importar el compartido y **no cambia de aspecto**.

Para el porcentaje se agrega un **anillo de progreso** dibujado con
`react-native-svg` (ya instalado, y ya usado en
`components/session-runtime/trajectory-sketch.jsx`, así que el riesgo de
renderizado en web es conocido y está cubierto). Da el "algo elegante" que se
pidió sin traer una librería de charts.

`expo-linear-gradient` se suma para el fondo/acento de las tarjetas. Está en el
bundle de Expo Go, pero **el proyecto no usa Expo Go**, así que exige regenerar
el dev client (ver R1). Es el mismo costo que `expo-print`/`expo-sharing`, que
son obligatorios, así que no agrega un paso nuevo al flujo.

### D7 — El QR se muestra con `expo-image` a partir del base64 del backend

El backend ya devuelve `qr_code_base64` (PNG). Se renderiza como data URI
(`data:image/png;base64,<...>`) con `expo-image`, que **ya está instalado**.

Esto evita por completo agregar una librería de QR en el cliente
(`react-native-qrcode-svg`): no hace falta *generar* el QR, solo *mostrar* uno que
el backend ya generó de forma determinista. Una dependencia nativa menos y, de
paso, el PDF usa exactamente la misma imagen que la pantalla.

### D8 — El PDF se genera en el cliente con `expo-print`, no en el backend

Se evaluó un endpoint de PDF en el backend. Descartado: el diseño del documento
iteraría con el equipo de diseño (que es explícito en el pedido), y cada iteración
significaría un deploy del backend. Con `expo-print.printToFileAsync({ html })` el
ciclo es local e instantáneo, y el mismo HTML sirve para la vista previa.

`utils/attendance-qr-pdf.js` arma el HTML con una plantilla propia: documento
A4, logo, nombre del equipo y fecha de la sesión en una cabecera, el QR como
elemento dominante centrado, horario y lugar en un bloque secundario, y
line-height / tamaños de print en `pt`. El HTML es una función pura de
`(team, session, qrDataUri)` → string, así que se puede testear sin device.

**El logo va como data URI base64.** `printToFileAsync` renderiza en un contexto
sin acceso a archivos locales, así que `assets/logo_paceron_*.png` no se puede
referenciar por ruta; hay que embeberla. Se lee con `expo-asset` (para resolver el asset) más
`expo-file-system` (para leer los bytes) en base64, y se cachea en memoria — es
un asset de build, no cambia en runtime.

Las dos se agregan **explícitas** a `package.json` por la convención del repo (ver
el pin de `@expo/metro-config` en `CLAUDE.md`): no depender de hoisting
transitive. `expo-asset` además ya venía como transitiva de `expo`;
`expo-file-system` **no estaba instalada de ninguna manera** (verificado contra
`node_modules`), así que es una dependencia nueva de verdad.

### D9 — Compartir: hoja nativa como camino principal, WhatsApp como atajo

Dos acciones, porque resuelven cosas distintas:

1. **Compartir (principal)** — `expo-sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle })`
   abre la hoja de compartir del sistema **con el archivo adjunto**. Es el camino
   que funciona para cualquier app de mensajes y es el único que adjunta el PDF
   de verdad.
2. **WhatsApp (atajo)** — `Linking.openURL('whatsapp://send?text=...')` con un
   mensaje que nombra equipo y sesión. Un deep link **no puede adjuntar un
   archivo**, así que este atajo es para "avisar que hay asistencia" rápido, no
   para mandar el PDF. Es exactamente lo que se pidió como atajo de un toque.

**Por qué `openURL` directo y no `Linking.canOpenURL` como guarda:** en Android 11+
`canOpenURL` devuelve `false` para cualquier esquema no declarado en
`<queries>` del manifest, **aunque la app esté instalada** — o sea, la guarda
mentiría justamente en el caso que importa. Por eso se hace `try { openURL }
catch { fallback }`, y el fallback es `https://wa.me/?text=...` (abre la web de
WhatsApp con el mismo mensaje). Así no hace falta tocar `app.config.js` con
`intentFilters` y el atajo nunca queda muerto en silencio.

En web `expo-sharing.isAvailableAsync()` devuelve `false`: la acción de compartir
cae al diálogo de impresión del navegador, que es el equivalente correcto
("Guardar como PDF" es exactamente lo que el usuario quiere hacer en web).

### D10 — `bypassGuard` no aplica; el guard se cleans sola cuando el guardado termina bien

`CLAUDE.md` exige `bypassGuard(action)` en pantallas que **navegan** después de un
submit. Acá no aplica: la pantalla **no** navega al guardar, se queda en la grilla
con los checks limpiados. El guard se desarma solo porque `useFormDirty` pasa a
`false` cuando la lista de checks se vacía tras el guardado exitoso.

El punto delicado es el **fallo**: si el guardado falla, los checks **no** se
limpian, así que `useFormDirty` sigue en `true` y el guard sigue armado — que es
lo correcto: el entrenador no pierde lo que iba a guardar.

### D11 — Pull-to-refresh y su interacción con la selección

`usePullToRefresh` sobre el `ScrollView` raíz, en la forma del ternario
`isMobile ? <RefreshControl .../> : undefined`. Cumple la convención de
`CLAUDE.md` (pantalla listable con datos que se vuelven a pedir al backend) y no
toca la selección: el `refetch` refresca la grilla de la sesión ya elegida.

Cuidado explícito: el `refetch` **no** pisa los checks marcados (ver D5), así que
un refresh a mitad de edición no pierde trabajo.

### D12 — Se extraen `StatTile` y el modal destructivo, y se reusan

Dos extracciones, justificadas justified por el hecho de que esta pantalla los necesita
y ya existen como código privado/duplicado:

- `components/shared/stat-tile.jsx` — desde `team-detail-screen.jsx:94-110`.
  Gana un prop `idPrefix` (parámetro requerido, para que el hardcodeo
  `team-detail-` desaparezca).
- `components/shared/confirm-destructive-modal.jsx` — desde
  `delete-team-modal.jsx`, tomando `{ visible, title, description, confirmLabel,
  loading, onCancel, onConfirm }` y sacando el `notifyWarning()` del `useEffect`
  para que lo disponga el caller (así el componente no decide cuándo vibrar).

**No** se migran los otros 3 modales destructivos del repo en este change: son
refactors sin valor para esta feature y ensuciarían el diff. Se dejan como
precedente a migrar cuando toque. La alternativa era copiar el shell una 5ta vez
en el módulo de asistencia, que es exactamente lo que `CLAUDE.md` marca como
patrón a generalizar.

## Risks / Trade-offs

- **[R1] Las 3 dependencias nuevas exigen regenerar el dev client.** El proyecto
  usa dev client custom (por `@maplibre`), y los módulos nativos de `expo-print`,
  `expo-sharing` y `expo-linear-gradient` tienen que estar linkeados en el APK:
  sin `npm run android:run` posterior, esas acciones fallan en runtime. No cambia
  el `runtimeVersion` (no hay bump de SDK de Expo). → Tarea explícita en `tasks.md`
  **antes** de verificar en dispositivo, y el resto de la pantalla (que no usa esas
  libs) se puede verificar en web sin el rebuild.

- **[R2] El deep link de WhatsApp no puede adjuntar el PDF.** Es una limitación
  de la plataforma, no del diseño. → Se documenta en el propio modal: el botón
  principal comparte el archivo, el atajo abre una conversación con el mensaje.
  Si alguna vez hace falta mandar el PDF sí o sí por WhatsApp, la vía es la hoja
  nativa (2 toques más).

- **[R3] `Linking.openURL` sin `canOpenURL` puede no fallar en web.** En web,
  abrir un esquema no soportado puede no lanzar excepción. → En `isWeb` el atajo
  va directo a `https://wa.me/` (comportamiento conocido y deseado), y el
  `try/catch` solo aplica al camino nativo. La función se decide por plataforma
  explícitamente, no por try/catch.

- **[R4] El logo embebido como base64 agranda el HTML del PDF.** Un PNG de
  ~200 KB en base64 son ~270 KB de string por render. → Se cachea el base64 en
  memoria a nivel de módulo (se lee una vez por sesión de app), y el logo se
  comprime/redimensiona al asset antes de embeberlo si pesara demasiado.

- **[R5] `SearchablePickerField` reimplementa la mecánica de `PickerField`.** Es
  el mismo `Modal` + lista, en ~150 líneas. → Se acepta: alternativa era un
  `<select>` nativo con `datalist` (no existe en RN) o una librería de combobox
  (dependencia nativa nueva, con todo lo que implica R1). Es el componente que
  más se va a reusar, así que el costo se paga una vez.

- **[R6] La grilla no usa `use-team-roster.js`** (D3). Dos fuentes de roster
  conviven. → Riesgo real de que alguien las "unifique" y rompa el `source` de la
  asistencia. Queda explicitado en D3 con su razón, y en `CLAUDE.md` como nota.

- **[R7] El listado de sesiones son todas las presenciales pasadas del grupo,
  sin paginación.** Un grupo con 2 años de viernes presenciales son ~100
  opciones. → El backend devuelve ~100 filas livianas (id, nombre, fecha, conteo),
  y el filtro local las maneja sin problema. El spec del backend dejó anotada la
  paginación por `from` como open question por si aparece el caso.

## Migration Plan

No hay migración de datos ni de estado: es una pantalla nueva. El orden importa
por dos dependencias:

1. **Backend primero.** `paceron-backend` debe tener mergeados los 4 endpoints nuevos
   más el `GET /qr` endurecido.
   Sin ellos, esta pantalla no tiene de dónde leer y los 403/422 del spec no
   existen.
2. **Después `npm install` de las 3 deps nuevas y `npm run android:run`** para
   el dev client (R1). La parte de la pantalla que no usa esas libs se verifica
   en web sin este paso.
3. Los servicios y hooks se pueden escribir y verificar con `npm test` (lógica
   pura) en cualquier momento.

**Rollback:** revertir la ruta de `routes/catalog.js` saca la pantalla de la
navegación; la pantalla y sus archivos quedan inertes. No hay estado persistido,
ni migraciones, ni cambios de esquema.

## Open Questions

Ninguna que bloquee. Dejable para `/opsx-apply` sin tocar specs:

- Si conviene un tercer shortcut de compartir (correo, Drive). La hoja nativa ya
  los cubre todos, asì que probablemente no.
- Si el atajo de WhatsApp debería llevar un link a la app para que el corredor
  registre su asistencia desde el chat. Sería el puente natural hacia la sesión
  de escaneo QR — pero eso ya pertenece al change siguiente, no a este.
