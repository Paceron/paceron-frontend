# Sesión presencial (2/2): cliente entrenador

## Contexto

Segundo sub-proyecto de "Registro de sesiones presenciales", sobre la infraestructura de tiempo
real y el cliente corredor ya construidos y mergeados a `develop` (spec 1,
`docs/superpowers/specs/2026-09-28-presencial-live-session-transport-runner-design.md`, PR #152).
Esta spec cubre el lado **entrenador**: pre-start propio, pantalla en vivo con mapa de
participantes, toma de asistencia integrada, feed de registros y cierre manual de la sesión.

Existente que esta spec extiende, no reemplaza:
- `services/realtime-client.js` / `hooks/use-realtime-channel.js` — bus WS genérico, canal
  `session:{sessionInstanceId}`, sobre de mensaje `{channel,type,event,from,to,payload,ts}`. Ya
  probado en producción por el cliente corredor.
- Vocabulario de mensajes ya definido y en uso: `presence:joined/left/position` (emitidos por el
  corredor), `control:session_paused/session_finished/announcement` (el corredor YA sabe
  reaccionar a los tres — emitidos por "el entrenador" en el diseño original, pero hasta ahora
  nadie los mandaba de verdad), `update:set_event` (server-only, ya se dispara al persistir
  `POST /workout-feedback`). Esta spec es la que efectivamente **envía** los `control` y
  **consume** `update:set_event` del lado entrenador.
- `components/attendance/` — módulo de gestión de asistencia ya completo y shippeado
  (`AttendanceGrid`, `AttendanceQrModal`, `hooks/use-attendance.js#useSessionAttendance`), sin
  ventana horaria propia (disponible en cualquier momento para una sesión presencial). Esta spec
  no le agrega lógica nueva — lo empaqueta en un modal propio para no salir de la sesión en curso.
- `hooks/use-team-roster.js` — roster de hoy de un grupo, fuente correcta para el listado "a
  priori" de participantes (a diferencia de la asistencia histórica, acá no hace falta el roster
  "de aquel momento": la sesión es de hoy/ahora).
- `components/session-runtime/session-pre-start-screen.jsx` /
  `training-session-live-screen.jsx` (corredor) — mismos patrones visuales/de gestos a clonar
  (`ExerciseRow` expandible, `DragToFinishButton`/`HoldToCancelButton`, `ConnectionBanner`,
  `MobileOnlyRoute`), sin tocarlos ni importarlos directo (mismo criterio ya aplicado en la spec 1:
  archivos propios, gestos duplicados y adaptados).
- `@maplibre/maplibre-react-native` (`Map`/`Camera`/`Marker`) — ya dependencia real, usado hoy en
  `components/shared/location-picker.jsx`.

## Alcance

**Sí:**
- `StartSessionButton` — nueva rama: `role === 'trainer' && assignment.isPresencial && !isWeb` →
  guarda `pendingSession` y navega al pre-start del entrenador. Hoy esa rama no existe: cualquier
  Play (entrenador incluido) cae en `/training-session`, la pantalla async del corredor.
- **Pre-start del entrenador** (`trainer-session-pre-start-screen.jsx`, ruta
  `/trainer-session-pre-start`) — clon visual del pre-start actual (fecha/hora, equipo/grupo,
  ubicación, lista de ejercicios expandible), con dos agregados:
  - Listado de participantes a priori (roster del grupo de la sesión), mismo patrón expandible que
    los ejercicios: primeros 5 alfabético + "Ver todos" con scroll completo. Buscador simple
    (`TextInput` + filtro en memoria, ver `utils/attendance-filter.js#filterByName`) arriba de la
    lista expandida — filtra la lista mostrada, no es un picker de formulario.
  - Botón de asistencia (ícono + label "Asistencia", distinto del ícono de escáner del corredor)
    que abre `AttendanceSessionModal`.
  - Botón Play propio: no crea ningún `session_run` local (el entrenador no ejecuta series) — solo
    une al canal WS como supervisor y arranca su propio GPS (confirmado: el entrenador comparte
    posición real, igual que un corredor).
- **`AttendanceSessionModal`** (nuevo, `components/session-runtime/`) — `Modal` con backdrop-close
  que monta `AttendanceGrid` + `useSessionAttendance(sessionInstanceId, teamId, groupId)` +
  `useSaveAttendance`/`useDeleteAttendance`, con botón "Mostrar QR" que abre `AttendanceQrModal`
  anidado. Sin ventana horaria propia (mismo criterio que ya tiene el módulo de asistencia hoy —
  no se le agrega ninguna restricción nueva). Un solo componente, usado desde el pre-start y desde
  la pantalla en vivo.
- **Pantalla en vivo del entrenador** (`trainer-session-live-screen.jsx`, ruta
  `/trainer-session-live`):
  - Mitad superior: mapa (MapLibre) con un `Marker` por corredor conectado (foto de perfil o
    iniciales, nombre) + uno propio distinguible como entrenador. Fuente: `presence:position` de
    cada corredor, sin bootstrap por REST (es una señal puramente en vivo). Botón de pantalla
    completa. Cámara con auto-encuadre (fit-bounds a todos los puntos) disparado solo al sumarse
    un corredor nuevo (`presence:joined`) — nunca en cada movimiento, para no marear con la cámara
    saltando; el entrenador puede paniar/zoomear libre entre medio.
  - Mitad inferior:
    - Fila: botón de asistencia (mismo `AttendanceSessionModal`) + botón "Participantes en vivo".
    - Participantes en vivo: roster completo (no solo conectados) con estado derivado de
      `presence:joined/left` + lo último sabido de sus series ("no se unió" / "en curso" /
      "pausado" / "completó todo"). Tocar uno abre su detalle: vista agrupada por ejercicio/serie
      (mismo concepto visual que la vista general del corredor), alimentada por
      `GET /session-instances/:id/feedback?athlete_user_id=X` al abrir (endpoint ya probado en la
      pantalla de revisión) + `update:set_event` en vivo mientras el detalle está abierto.
    - Botón "Ver registros" → feed cronológico (más reciente primero) de series
      completadas/salteadas de TODOS los corredores, con `SearchablePickerField` para filtrar por
      un corredor puntual (acá sí aplica como picker de formulario real). Bootstrap: ver "Gap a
      confirmar" abajo — con fallback ya decidido si el gap no se resuelve a tiempo. En vivo: cada
      `update:set_event` que llega se agrega al tope sin esperar refetch.
    - Slide para finalizar (adaptación de `DragToFinishButton`) — **cierre manual únicamente, sin
      auto-finalización** (decisión explícita: el modelo de ventana horaria estricta que
      justificaría un auto-cierre queda para más adelante, cuando exista una ventana rigurosa de
      inicio/fin). Al confirmar: `control:session_finished` a todo el canal (`to: 'all'`) — el
      cliente corredor ya sabe reaccionar (spec 1), cierra su sesión solo. El entrenador desconecta
      su canal y vuelve.
- **Animaciones** (reanimated, sin dependencia nueva):
  - Pulso sutil en cada marcador del mapa mientras recibe `presence:position` reciente; se atenúa
    si no hay actualización en ~15-20s (señal real de posible corte de conexión de ESE corredor,
    no solo decorativo).
  - Mismo pulso en el punto del banner de conexión ("En vivo"/"Reconectando") — pendiente desde la
    spec 1, resuelto acá y aplicado a las dos pantallas.
  - Borde sutil con glow en el chip "en curso" de la lista de participantes.
- Gestos de la sesión en vivo del entrenador (slide-para-finalizar, cualquier confirmación por
  mantener-presionado que surja al plan) se construyen adaptando los mismos mecanismos ya
  probados del corredor (`activateAfterLongPress`, `failOffset*`, `Gesture.Simultaneous` donde
  aplique) — no se reinventa el arbitraje de gestos ya resuelto en la spec 1.

**No** (fuera de alcance, queda para después):
- Contenido interno del popup de asistencia más allá de lo que `components/attendance/` ya
  resuelve — si hace falta ajustar algo puntual del módulo existente para que encaje mejor en el
  modal, es una vuelta aparte coordinada con el compañero que lo construyó.
- Auto-finalización de la sesión sin el entrenador presente — depende de un modelo de ventana
  horaria estricta que todavía no existe (hoy ninguna modalidad, presencial incluida, es estricta
  con el horario).
- Pausar a un corredor puntual desde la pantalla del entrenador — el transporte ya lo soporta
  (`control:session_paused` con `to: {userId}`), pero no se pidió como feature de esta spec; el
  detalle por corredor es de solo lectura (ver su avance, no controlarlo).
- Trazado de ruta ideal y detección de desvíos — confirmado como descartado incluso para versión
  final, no solo MVP (deferred desde la spec 1).
- Reconstrucción de la trayectoria completa de un corredor a posteriori — mismo límite ya
  documentado en la spec 1 (solo los tramos con serie activa quedan durables).

## Gap a confirmar con backend (no bloquea el plan)

`GET /session-instances/:id/feedback` está documentado siempre con `?athlete_user_id=` — nunca se
confirmó si, omitiendo ese filtro, devuelve el feedback de **todos** los atletas de la sesión (lo
que necesita el bootstrap del feed de registros, sección "Ver registros" arriba). Se confirma en
paralelo con backend, mismo patrón que Gap 18 de la spec 1. **Fallback ya decidido si no se
confirma a tiempo o el backend responde que no:** fan-out de `useQueries`, una consulta
`?athlete_user_id=` por miembro del roster de la sesión, mismo patrón ya probado en
`hooks/use-team-roster.js` para resolver nombres. Con el fallback, el plan no queda bloqueado por
este gap — se implementa así desde el principio y se simplifica a una sola consulta más adelante
si backend confirma que el filtro es opcional.

## Testing

Mismo criterio que la spec 1 (sin tests de render de componentes, por convención del proyecto):
Jest cubre lógica pura extraíble — construcción del feed a partir de una lista de eventos
`update:set_event` (orden, filtrado por atleta), derivación de "estado" de un participante a
partir de presence + último evento conocido, y cualquier cálculo de bounds/encuadre del mapa que
se pueda aislar de la librería de mapas. El comportamiento real de MapLibre, el gesto del slide, y
el timing de reconexión no son simulables de forma confiable en el preview — verificación en
dispositivo real, mismo límite ya documentado en CLAUDE.md.

## Archivos

**Nuevos:**
- `components/session-runtime/trainer-session-pre-start-screen.jsx` + `app/trainer-session-pre-start.jsx`.
- `components/session-runtime/trainer-session-live-screen.jsx` + `app/trainer-session-live.jsx`.
- `components/session-runtime/attendance-session-modal.jsx`.
- `hooks/use-trainer-session-runtime.js` — equivalente al hook del corredor pero sin SQLite ni GPS
  por serie: solo canal WS (join/leave/position propios, control saliente, consumo de
  `update:set_event`) + lectura REST bajo demanda (detalle por atleta, feed).
- Probablemente un componente chico de marcador de mapa (`TrainerMapMarker`/similar, foto o
  iniciales + pulso) — a definir el nombre exacto en el plan.

**Modificados:**
- `components/calendar/start-session-button.jsx` — rama nueva para `role === 'trainer'` +
  presencial + no-web, hoy inexistente para el caso "sesión de hoy, todavía no pasó".
- `docs/BACKEND_API_GAPS.md` — nueva entrada para el gap de arriba (todos-los-atletas).

**Sin tocar:** `components/session-runtime/session-pre-start-screen.jsx`,
`training-session-active-screen.jsx`,
`components/session-runtime/training-session-live-screen.jsx` (corredor, spec 1 — ya consume
`control:session_finished`/`session_paused` tal como los manda esta spec, sin ningún cambio de
código de su lado), `components/attendance/*` (se consume tal cual, sin modificar sus componentes
internos), `services/realtime-client.js`, `hooks/use-realtime-channel.js`.
