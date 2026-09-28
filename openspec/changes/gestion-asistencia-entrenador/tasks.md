# Tasks — Gestión de asistencia desde el panel del entrenador

Rama: `feature/gestion-asistencia-entrenador` desde `develop` (**no** desde
`feature/QRExperience`, que es la rama en la que está el árbol hoy).

> **Precondición de este change:** el backend debe tener mergeado
> `gestion-asistencia-entrenador` (repo `paceron-backend`). Los 5 endpoints que se
> consumen acá — 4 nuevos más el `GET /qr` existente — están especificados en su `specs/attendance-management/spec.md` y
> en sus `proposal.md` / `design.md`. Si el backend todavía no está, parar acá —
> no se puede verificar nada sin los endpoints.

Contexto de ejecución:
- `npm test` (Jest, lógica pura) y `npm run lint` en verde antes de mergear. CI
  corre ambos en el mismo job.
- Lint con las 3 reglas locales activas: `local/require-native-id`,
  `local/no-direct-select-field`, `local/require-modal-backdrop-close`.
- Rama desde `develop`, bump de versión **menor** en `package.json` dentro de esta
  misma PR.
- Stagear solo rutas explícitas. No push/merge (lo hace el usuario).

## Etapa 0 — Dependencias y route catalog

- [x] **0.1** `npx expo install expo-print expo-sharing expo-linear-gradient expo-file-system` (versiones alineadas al SDK 54; las 4 son nuevas — `expo-file-system` no estaba ni como transitiva, hay que agregarla). `expo-asset` **ya está instalada** como transitiva de `expo` (`12.0.13`); agregarla explícita a `package.json` con esa misma versión porque se importa directo (D8, convención de pineos explícitos del `CLAUDE.md`).
- [x] **0.2** `npx expo-doctor` — confirmar que las 5 dependencias resuelven a versiones del SDK 54 y que ninguna quedó fuera de rango. Anotar en el commit que el dev client custom hay que regenerarlo (R1). **No** regenerarlo todavía: el rebuild va al final (etapa 8), después de tener la pantalla funcionando en web.
- [x] **0.3** 🚦 **GATE — el bundle web tiene que seguir levantando después de agregar las deps.** Agregar dependencias es el paso que más fácil rompe un build, así que se verifica acá y no al final. Detalle en **Etapa 9** (tarea 9.1): `npx expo export -p web` tiene que terminar sin errores. Si falla, se arregla acá, antes de escribir una sola línea de la feature.
- [x] **0.4** Bump menor de versión en `package.json`.
- [x] **0.5** `routes/catalog.js`: agregar `attendanceRoute` (`name: 'attendance'`, `href: '/attendance'`, `icon: 'clipboard-check-outline'`, `role: 'trainer'`) y sumarlo a `navigationRoutes`.
- [x] **0.5** `__tests__/routes.catalog.test.js`: bloque nuevo verificando que `getRoutesByRole('trainer')` incluye la ruta y `getRoutesByRole('runner')` no. Correr `npm test`.

## Etapa 1 — Extracciones (desacopladas, se pueden hacer primero)

- [x] **1.1** `components/shared/stat-tile.jsx`: extraer de `components/team/team-detail-screen.jsx:94-110`. Prop `idPrefix` **requerido** (sacar el hardcodeo `team-detail-` de los `nativeID`/`testID`). Mantener el aspecto visual actual.
- [x] **1.2** `team-detail-screen.jsx`: importar el `StatTile` compartido y borrar el local. Verificar que los ids sigan siendo los mismos para no romper nada que los apunte.
- [x] **1.3** `components/shared/confirm-destructive-modal.jsx`: extraer de `components/team/delete-team-modal.jsx`, con props `{ visible, title, description, confirmLabel, loading, onCancel, onConfirm }`. **El `notifyWarning()` lo dispara el caller** vía `useEffect`, no el componente (D12). Backdrop `Pressable` → `onCancel`; card `Pressable` con `onPress={() => {}}` (regla `local/require-modal-backdrop-close`).
- [x] **1.4** `delete-team-modal.jsx`: pasar a usar el compartido, con su `useEffect` de `notifyWarning` explícito. `npm run lint` en verde.
- [x] **1.5** **No** migrar los otros 3 modales destructivos del repo (D12).

## Etapa 2 — Capa de datos

- [x] **2.1** `services/attendance.js` — 5 funciones con la forma de `services/workoutFeedback.js` (comentario `// GET /api/v1/...` arriba, guarda `USE_MOCKS` primero):
  - `listAttendanceSessions(groupId, teamId)`
  - `getSessionAttendance(sessionInstanceId, teamId, groupId)`
  - `bulkSaveAttendance({ teamId, trainingSessionId, userIds })` — **`userIds` en el body va con `Number()`** (regla del `CLAUDE.md`: los ids del roster normalizado son string y el backend rechaza `user_id` no numérico)
  - `getAttendanceQr(teamId, trainingSessionId)`
  - `deleteAttendance(attendanceId, teamId)` — el `api.delete` **no** acepta body, así que el `team_id` va en el query string inline
- [x] **2.2** `services/__mocks__/attendance-mock.js` con las 5 (convención `USE_MOCKS`).
- [x] **2.3** `utils/attendance-filter.js`: `normalizeForSearch(text)` (NFD + strip de diacríticos + minúsculas) y `filterByName(options, query, nameKey)`. Función pura → **test en `__tests__/attendance-filter.test.js`** (acentos, mayúsculas, query vacío, coincidencia parcial).
- [x] **2.4** `utils/attendance-payload.js`: `toBulkAttendancePayload({ teamId, trainingSessionId, userIds })` y `toAttendanceRate(summary)`. Puros → test.
- [x] **2.5** `hooks/use-attendance.js` — **patrón C** (D4: las mutaciones propagan el error, sin `{success, error}`):
  - `useAttendanceSessions(groupId, teamId)` — `enabled: Boolean(groupId && teamId)`, key `['attendance','sessions',teamId,groupId]`, retorna `{ sessions, isLoading, error }`
  - `useSessionAttendance(sessionInstanceId, teamId, groupId)` — key `['attendance','grid',teamId,groupId,sessionInstanceId]`, retorna `{ rows, summary, isLoading, error, refetch, isRefetching }`
  - `useSaveAttendance(...)` — `onSuccess` invalida **por prefijo** `['attendance', teamId]`
  - `useDeleteAttendance(...)` — ídem
- [x] **2.6** `npm test` + `npm run lint` en verde. Confirmar que los `Number()` del punto 2.1 están (es el bug ya documentado de `addGroupUser`).

## Etapa 3 — `SearchablePickerField` (componente compartido)

- [x] **3.1** `components/forms/searchable-picker-field.jsx` (D1): trigger + `Modal` con `TextInput` de filtro + lista filtrada, siguiendo la forma de `components/team/athlete-picker-modal.jsx:11-29`.
- [x] **3.2** Props: `label`, `value`, `options` (`{ id, name }`), `onChange`, `placeholder`, `disabled`, `loading`, `emptyMessage`, `renderOptionMeta?` (para el caso de sesión: fecha + conteo), `idPrefix`. **NativeWind inline con `dark:`** para claro/oscuro (patrón del `CLAUDE.md`).
- [x] **3.3** Filtro con `filterByName` (2.3). Normaliza acentos y mayúsculas.
- [x] **3.4** Reglas de modal: backdrop `Pressable` con `onPress` → cerrar, card `Pressable` con `onPress={() => {}}`, `onRequestClose` → cerrar. Cumple `local/require-modal-backdrop-close`.
- [x] **3.5** `nativeID` + `testID` en **cada** `View`/`Text`/`TextInput`/`Pressable`/`Modal`, todos con prefijo `idPrefix` (regla `local/require-native-id`).
- [x] **3.6** Web y mobile: mismo componente, sin `.web.jsx`. Verificar que el modal y el `TextInput` funcionan en ambos.
- [x] **3.7** Accesibilidad: `accessibilityState={{ selected }}` en cada opción, `accessibilityLabel` en el trigger.
- [x] **3.8** `npm run lint` en verde.

## Etapa 4 — Pantalla: cascada de selección

- [x] **4.1** `app/(tabs)/attendance.jsx` — wrapper mínimo, auto-descubierto por Expo Router, hereda el shell de `app/(tabs)/_layout.jsx` sin `.web.jsx` (D2).
- [x] **4.2** `components/attendance/attendance-screen.jsx`: parsear los query params opcionales `team_id` / `session_instance_id` con `useLocalSearchParams`.
- [x] **4.3** Estado de la cascada: `teamId`, `groupId`, `sessionInstanceId` + `selectedIds: Set<string>` (D5). Cambiar equipo → limpiar grupo y sesión y **preseleccionar el primer grupo**; cambiar grupo → limpiar sesión.
- [x] **4.4** Datos de los selectores: equipos desde `use-teams.js` (`listTeams({ ownerId })` / `selectAdministeredTeams`), grupos desde `use-groups.js` (`useGroups(teamId, userId)`), sesiones desde `useAttendanceSessions` (2.5).
- [x] **4.5** Los tres `SearchablePickerField` en un `components/shared/filter-panel.jsx`, con la forma del cascada de `administered-calendar-screen.jsx:151-176` pero **sin** el sentinela `"Todos los equipos"` (esta pantalla es de una selección concreta, no de filtro).
- [x] **4.6** Empty/disabled: equipo sin grupos → selector de grupo deshabilitado + mensaje; grupo sin sesiones → selector de sesión deshabilitado con el mensaje del spec. No mostrar un select vacío sin explicación.
- [x] **4.7** Deep link: si vienen `team_id` y `session_instance_id` válidos → arrancar con la sesión cargada. Si la sesión no existe → mensaje + selector disponible. Si no es del equipo → mensaje de permisos **sin revelar datos** de la sesión.
- [x] **4.8** Deep link de rol: si `activeRole` no es `trainer`, mostrar el aviso de "exclusivo del entrenador" (spec requirement 1), sin grilla ni botón de QR.
- [x] **4.9** Guard de rol: `components/guards/require-auth.jsx` envolviendo la pantalla, como en `administered-calendar-screen.jsx:206-212`.
- [x] **4.10** `npm run lint` + `npm test` en verde.

## Etapa 5 — Pantalla: métricas y grilla

- [x] **5.1** `components/attendance/attendance-metric-cards.jsx`: 3 tarjetas (asistentes / sin confirmar / %) usando el `StatTile` compartido (1.1) + `expo-linear-gradient` para el acento + **anillo de progreso en `react-native-svg`** para el % (D6). `0 %` cuando `roster_size === 0`.
- [x] **5.2** `components/attendance/attendance-row.jsx`: nombre, email, estado (`asistió` / `no confirmó`), procedencia (`source`: "por QR" / "cargada por el entrenador"), check de selección y acción de eliminar (solo si tiene asistencia). Estilo de fila seleccionada siguiendo `exercises-catalog-tab.jsx:119` (borde + bg primitivos).
- [x] **5.3** La grilla **no** usa `use-team-roster.js` — usa `useSessionAttendance` (D3). No "unificar" con el roster (D6/R6): el endpoint de grilla trae `source` y el roster no.
- [x] **5.4** Botón "Guardar cambios" en el header de la sección, con el contador de marcadas (patrón `exercises-catalog-tab.jsx:291`). `disabled` si `selectedIds.size === 0` (spec scenario "No hay nada marcado").
- [x] **5.5** Al guardar con éxito: limpiar `selectedIds`, invalidar el grid + sessions (los conteos del selector se desactualizan), `notifySuccess()` **antes** del `toast.success` (convención `CLAUDE.md`).
- [x] **5.6** Al fallar: **no** limpiar `selectedIds`, `notifyError()` + `toast.error` con `error.message` real del backend (patrón C, D4). Distinguir 403 ("no sos entrenador") de 422 ("la sesión ya no es presencial") por `error.status`.
- [x] **5.7** Estados: `isLoading` → spinner (no empty state), sin sesión → mensaje de elegir los 3, grupo vacío → mensaje de "el grupo no tiene corredores", error → mensaje + acción de reintentar.
- [x] **5.8** `usePullToRefresh` (D11) con el ternario `isMobile ? <RefreshControl .../> : undefined`. El refetch **no** debe pisar `selectedIds`.
- [x] **5.9** `useFormDirty(selectedIds.size > 0)` + `useUnsavedChangesGuard` + `DiscardChangesModal` (D10). Cambiar equipo/grupo/sesión con checks marcados también pasa por `guardedClose`/confirmación.
- [x] **5.10** `npm run lint` + `npm test` en verde.

## Etapa 6 — Borrado individual

- [x] **6.1** Estado `pendingDelete` (fila a confirmar) en la pantalla.
- [x] **6.2** `ConfirmDestructiveModal` compartido (1.3) con `description` que nombre **corredor y fecha de la sesión** (spec scenario "El modal identifica corredor y sesión"). `notifyWarning()` en el `useEffect` de apertura, en el caller.
- [x] **6.3** Confirmar → `useDeleteAttendance`; éxito → invalidar, `notifySuccess()` + toast; fallo → `notifyError()` + mensaje, la fila **no** cambia y las métricas no se tocan.
- [x] **6.4** Cancelar → cerrar sin request. Borrar con checks marcados en otras filas → los checks **se conservan** (spec scenario "Borrar mientras hay checks marcados").
- [x] **6.5** Verificar que **no** exista ninguna acción de borrado masivo (es un requisito explícito del spec).

## Etapa 7 — QR, PDF y compartir

- [ ] **7.1** `utils/attendance-qr-image.js`: `toQrDataUri(base64)` → `data:image/png;base64,...`. Función pura → test.
- [ ] **7.2** Botón "Generar QR" en el header de la sesión, habilitado incluso con checks sin guardar (spec scenario "El QR sigue disponible con cambios sin guardar") y sin asistencias.
- [ ] **7.3** `components/attendance/attendance-qr-modal.jsx`: modal con el QR vía `expo-image` + data URI (D7), nombre del equipo, nombre y fecha de la sesión. Backdrop `Pressable` → cerrar, card `Pressable` no-op, `onRequestClose` → cerrar (regla `local/require-modal-backdrop-close`).
- [ ] **7.4** `utils/attendance-qr-pdf.js` (D8): `buildAttendanceQrHtml({ team, session, qrDataUri, logoDataUri })` → string HTML A4 con diseño propio (cabecera con logo + equipo + fecha, QR dominante centrado, bloque de horario/lugar **solo si existen**). Función pura → **test en `__tests__/attendance-qr-pdf.test.js`** (contiene equipo, contiene fecha, contiene el data URI, omite horario/lugar vacíos, escapa HTML de los nombres).
- [ ] **7.5** `utils/attendance-qr-logo.js`: resolver el asset con `expo-asset` y leer los bytes con `expo-file-system` (`FileSystem.readAsStringAsync`, `base64`), **cacheado a nivel de módulo** (se lee una vez por sesión de app, R4). Si en algún momento `expo-asset` resultara insuficiente para el base64, la alternativa sin dependencia nueva es `fetch(asset.localUri)` + `FileReader` en web — pero eso no aplica en nativo, así que `expo-file-system` sigue siendo la opción correcta multiplataforma.
- [ ] **7.6** Acción "Descargar PDF": `expo-print.printToFileAsync({ html })` en nativo; en web, el diálogo de impresión del navegador (equivalente a "Guardar como PDF"). Excepción → aviso de error y el modal **sigue abierto** (spec scenario "La descarga falla").
- [ ] **7.7** `utils/attendance-qr-share.js` (D9): `shareAttendanceQr(uri)` → `expo-sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle })`, con fallback al diálogo de impresión en web. `shareViaWhatsApp({ team, session })` → en nativo `try { Linking.openURL('whatsapp://send?text=...') } catch { Linking.openURL('https://wa.me/?text=...') }`; en web directo a `https://wa.me/`. **Sin `Linking.canOpenURL`** (R2/R3).
- [ ] **7.8** Botones en el modal: "Descargar PDF", "Compartir" y "Compartir por WhatsApp" con íconos. Etiqueta honesta: el atajo de WhatsApp abre una conversación (no adjunta el PDF) — dejarlo claro en el `accessibilityLabel` y en el texto de apoyo (R2).
- [ ] **7.9** `npm test` (los 3 archivos puros nuevos) + `npm run lint` en verde.

## Etapa 8 — Verificación, documentación y cierre

- [ ] **8.1** **Web (preview)**: recorrido completo — elegir equipo → grupo preseleccionado → sesión → grilla → marcar 3 → guardar → métricas actualizadas → borrar una con confirmación → generar QR → PDF → compartir. Confirmar que el `useQuery` no tira requests por corredor.
- [ ] **8.2** **Responsive web**: verificar a <1024px (shell angosto) y >1024px (shell ancho) que la grilla y los 3 selectores se ven bien, y que no hay scroll horizontal.
- [ ] **8.3** **Permisos**: con rol `runner` la entrada no aparece en la nav y la URL directa muestra el aviso de entrenador.
- [ ] **8.4** **Guard**: marcar checks → intentar salir → confirmar/cancelar; cambiar de sesión con checks → confirmar/cancelar; guardar y salir → sin aviso.
- [ ] **8.5** `npm run android:run` para regenerar el dev client con las 4 deps nuevas + `expo-asset` explícita (R1). Recién acá probar QR/PDF/Compartir en device real.
- [ ] **8.6** `CLAUDE.md`: nota con (a) que `SearchablePickerField` es el patrón para selects con búsqueda y cuándo `ResponsiveSelectField` alcanza, (b) la decisión de PDF/share en cliente y por qué WhatsApp es deep link, (c) que la grilla de asistencia **no** usa `use-team-roster.js` a propósito (R6), (d) que las deps nuevas obligan a regenerar el dev client.
- [ ] **8.7** `npm test` completo + `npm run lint` en verde.
- [ ] **8.8** Commit por etapa, subject en inglés y cuerpo en español si el "por qué" no es obvio del diff. **Sin push/merge.**

## Etapa 9 — Smoke de arranque: el front levanta en web y en mobile

Etapa de **gate de regresión**, no de feature. La pregunta que tiene que responder
es "¿la app sigue arrancando en las dos plataformas?" — no "¿funciona la
asistencia?". Se ejecuta aunque la etapa 8 haya ido bien, y **bloquea el
merge**: un change que agrega 3 módulos nativos y una ruta nueva sin confirmar
que la app levanta es un change que puede romper producción en el deploy de
Vercel sin que nadie lo note hasta que un usuario reporte la pantalla en blanco.

> La **9.1** se ejecuta dos veces: como gate temprano (tarea 0.3, apenas se
> instalan las deps) y de nuevo acá al cierre, cuando ya está todo el código de
> la feature.

### Web

- [ ] **9.1** 🚦 `npx expo export -p web` termina **sin errores** y genera el bundle. Es el mismo build command que usa Vercel (`vercel.json`), o sea que si esto pasa, el deploy de `develop`/`master` no se rompe. Es el gate más valioso de la etapa: el preview web (`expo start`) es más permisivo que el export de producción.
- [ ] **9.2** `npm run web` levanta y la home carga sin pantalla en blanco. Con una sesión de entrenador iniciada, la entrada "Asistencia" aparece en el shell ancho y en el angosto.
- [ ] **9.3** `/attendance` reachable por URL directa (deep link) sin romper el router — el archivo nuevo en `app/(tabs)/` lo auto-descubre Expo Router, pero conviene confirmarlo y no asumirlo.
- [ ] **9.4** Recorrer el shell completo en web: home, equipos, calendario, entrenamiento, perfil. Que ninguna pantalla haya quedado rota por el `StatTile` extraído (tarea 1.2 lo toca).
- [ ] **9.5** Revisar la consola del navegador: sin `Cannot use 'import.meta' outside a module` ni warnings de `expo-print`/`expo-sharing` en web. Si aparece lo de `import.meta`, es el quirk de `maplibre-gl@6.x` documentado en `CLAUDE.md`: **bajar de versión**, no parchear Metro.

### Mobile (Android, dev client)

- [ ] **9.6** 🚦 `npm run android:run` compila e instala **sin errores de linkeo nativo**. Si Gradle falla con un módulo nativo no encontrado, es R1: la dependencia quedó fuera del bundle del dev client.
- [ ] **9.7** `npx expo start --dev-client` levanta y la app abre en el device/emulador.
- [ ] **9.8** La pantalla de asistencia abre en el device y se ve `AppMobileShell` (el shell mobile **solo** renderiza con `Platform.OS !== 'web'`, así que el preview web no lo ejercita — es el motivo de que esta subtarea exista).
- [ ] **9.9** En el device, las 3 acciones que **solo existen en nativo**: descargar PDF (el archivo se genera y se puede abrir), hoja de compartir nativa, y el deep link de WhatsApp. En web ninguna de las tres aplica — por eso el PDF y el share no se pueden dar por verificados con el preview web.
- [ ] **9.10** Android logcat sin errores de módulos nativos faltantes al abrir el modal de QR.
- [ ] **9.11** Si en algún momento se toca `metro.config.js` (no debería en este change): reiniciar con `npx expo start -c`. Los cambios de config de Metro **no** son hot-reloadable (nota de `CLAUDE.md`).

### Cross-check de contrato

- [ ] **9.12** 🚦 Con el backend mergeado y desplegado, la pantalla real (no mocks) trae datos: la cascada de grupos y el listado de sesiones presenciales cargan, y la grilla muestra corredores. Si la pantalla levanta pero queda vacía, el problema **no** es de arranque — es de contrato: revisar contra `paceron-backend/openspec/changes/gestion-asistencia-entrenador/specs/attendance-management/spec.md` que el shape de la respuesta y los nombres de los campos coinciden.
- [ ] **9.13** `npm test` + `npm run lint` en verde, una última vez, con todo el árbol de la feature ya presente.

### Dependencia de orden entre etapas

`0 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9`, con `1` (extracciones) en cualquier momento
antes de `5.1` y `6.2`. La etapa `7` necesita los endpoints del backend; la `5`
también. Si el backend no está mergeado, se puede avanzar hasta `4` (la UI de la
cascada con datos mock por `USE_MOCKS`) pero **no** verificar `5`, `7` ni `9.12`.

Los **gates 🚦** (0.3, 9.1, 9.6, 9.12) bloquean: si uno falla, se para y se
arregla antes de seguir. Un bundle web que no exporta o un dev client que no
linkea son cosas que se pueden deber a este change o no — pero hay que
descubrirlo **con el change todavía chico**, no con 9 etapas encima.
