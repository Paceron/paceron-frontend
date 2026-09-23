# Base de navegación para el registro de actividad en vivo

## Contexto

Próximo módulo grande: registro de la actividad realizada durante un entrenamiento — asíncrono
por el corredor (cronómetro + GPS en background), y presencial por el entrenador (caso especial
del mismo flujo, con asistencia/QR y monitoreo en vivo a futuro). Ver
`docs/FUNCTIONAL_PROPOSE.md` ("Registro y seguimiento de actividades deportivas" / "Control de
sesiones presenciales grupales") — el módulo estaba previsto desde el diseño funcional original,
nunca se había construido nada.

Este documento cubre **solo la base**: cómo se llega desde el calendario hasta la pantalla previa
al inicio de una sesión, con qué datos, y qué queda documentado para que la interfaz de registro
en sí (cronómetro, series, pausas, GPS, resumen final, guardado) se construya encima sin tener que
resolver de nuevo el "cómo llego hasta acá". La interfaz de registro real es trabajo de otra
persona del equipo, fuera de esta spec.

## Alcance

**Sí:**
- Botón de inicio en el calendario (corredor y entrenador), con gating por fecha/horario.
- Store transitorio para pasar los datos del día elegido sin duplicar fetch.
- Ruta nativa nueva + pantalla previa al inicio (fecha, nombre de sesión, preview de ejercicios,
  botón Play).
- Ruta stub vacía a la que apunta el botón Play (la arma el compañero).
- Definiciones de diseño documentadas (nativo-only, historial multiplataforma).

**No** (fuera de esta spec, queda para el módulo real):
- Cronómetro, series, pausas, skip, notificación persistente, GPS en background.
- Pantalla de resumen final y guardado en almacenamiento local nativo.
- Historial (ver/editar/eliminar actividad finalizada).
- Asistencia/QR, monitoreo en tiempo real de ubicación de participantes.
- Banner del home ("próximo entrenamiento", Gap 10 ya resuelto en backend) — la UI del home con
  esos banners (pieza 3 del sub-proyecto de calendario) no está construida todavía. El gating util
  de esta spec queda listo para reusarse ahí sin cambios cuando esa pieza se aborde.

## Cómo el pre-start screen recibe los datos del día

**Elegido: store transitorio en Zustand.** El componente que dispara la navegación (el botón del
calendario) ya tiene en memoria el día completo (`AggregatedCalendarDayModel` /
`GroupCalendarDayModel`, con `sessionInstance.exercises` incluido) — lo escribe en el store antes
de navegar, la pantalla nueva lo lee. Sin endpoint nuevo, sin problema de serializar el array
anidado de ejercicios en una URL.

```js
// store/session-runtime-store.js
import { create } from 'zustand';

export const useSessionRuntimeStore = create((set) => ({
  pendingSession: null,
  setPendingSession: (day) => set({ pendingSession: day }),
  clearPendingSession: () => set({ pendingSession: null }),
}));
```

**Limitación conocida, aceptada para esta base:** no sobrevive un cold-start (deep link desde una
notificación del sistema con la app cerrada). No es un problema hoy porque el hop es
calendario → pre-start dentro de la misma sesión de la app. Cuando el compañero construya la
reanudación real después de background/cierre, el registro en curso ya se persiste en
almacenamiento local nativo (decisión suya, para evitar líos de offline) — esa capa es la que
debería resolver el resume, no este store.

**Mejora futura anotada, no implementada ahora:** `GET /calendar-days/{id}` en el backend
permitiría reconstruir `pendingSession` desde cero (deep-link-safe, independiente del store en
memoria) — más sólido para cuando el resume desde notificación exista de verdad. Se deja anotado
en `docs/BACKEND_API_GAPS.md` como mejora futura, no como bloqueante de esta base.

## Gating por fecha/horario

Función pura, testeable con Jest, sin dependencia de React:

```js
// utils/session-start-window.js
import { pad2 } from './calendar-month-range.js';

const PRESENCIAL_WINDOW_MINUTES = 30;

export function isToday(isoDate) {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  return isoDate === todayISO;
}

export function canStartAsyncSession(day) {
  return day.kind === 'training' && !day.isPresencial && isToday(day.date);
}

export function canStartPresencialSession(day) {
  if (day.kind !== 'training' || !day.isPresencial || !day.presencialTimeFrom) return false;
  if (!isToday(day.date)) return false;
  const [hours, minutes] = day.presencialTimeFrom.split(':').map(Number);
  const scheduledStart = new Date();
  scheduledStart.setHours(hours, minutes, 0, 0);
  const diffMinutes = (Date.now() - scheduledStart.getTime()) / 60000;
  return diffMinutes >= -PRESENCIAL_WINDOW_MINUTES && diffMinutes <= PRESENCIAL_WINDOW_MINUTES;
}
```

**Asunción a confirmar en la revisión de esta spec:** la ventana de ±30 min se mide contra
`presencial_time_from` (horario de inicio planificado), no contra `presencial_time_to`.

El corredor solo ve el botón en asignaciones con `isPresencial === false` — la presencial la
arranca el entrenador; la participación del corredor en una presencial (asistencia vía QR) es un
módulo distinto, no un "iniciar" desde su lado.

Recálculo: en `useFocusEffect` al enfocar la pantalla del calendario. Sin ticker por segundo — la
ventana es de 30 minutos, no hace falta esa precisión.

## Componente de botón compartido

Un solo lugar de lógica, usado en los 3 puntos de entrada del calendario (evita duplicarla en
`day-detail-modal.jsx` × 2 variantes + `group-calendar-day-screen.jsx`):

```jsx
// components/calendar/start-session-button.jsx
export function StartSessionButton({ assignment, role }) // role: 'runner' | 'trainer'
```

- `role === 'runner'` → elegible si `canStartAsyncSession(assignment)`.
- `role === 'trainer'` → elegible si `canStartPresencialSession(assignment)`.
- No elegible → no renderiza nada (sin placeholder ni copy explicando el porqué — mantener el
  alcance mínimo, se puede sumar feedback más claro después si hace falta).
- `onPress`: `setPendingSession(assignment)` seguido de `router.push('/training-session')`.

Se integra en:
- `components/calendar/day-detail-modal.jsx` (`AssignmentRow`, variantes `member` y
  `administered`).
- `components/team/group-calendar-day-screen.jsx`.

## Rutas y pantallas

**`app/training-session/index.jsx`** — fuera de `(tabs)`, pantalla apilada sin tab bar. Sin
params — lee `pendingSession` del store. Guard de entrada (patrón `<Redirect>`, no
`router.replace()` en un `useEffect` — ver convención ya establecida en el proyecto):

```jsx
if (!pendingSession || Platform.OS === 'web') return <Redirect href="/" />;
```

**`components/session-runtime/session-pre-start-screen.jsx`** — la pantalla del sketch: día +
fecha (`formatWeekdayLabel`/`formatDisplayDate`, ya existentes), nombre de la sesión, primeros N
ejercicios de `pendingSession.sessionInstance.exercises`, botón "..." que abre un modal con el
listado completo (repeticiones/series/descansos — mismo shape ya usado en
`stamp-plan-modal.jsx`), botón Play grande al final.

**`app/training-session-active.jsx`** — stub, una pantalla con placeholder "Próximamente" y un
comentario indicando que la construye el compañero. Existe solo para que el botón Play de arriba
tenga a dónde navegar sin romper.

## Definiciones de diseño a dejar escritas

- **Nativo exclusivo:** todo `components/session-runtime/` y las 2 rutas nuevas son
  `Platform.OS !== 'web'` — a diferencia de mp-connect (que sí tenía variante web), acá no hay
  fallback web posible (se necesitan sensores reales). Se documenta como nueva entrada en la
  sección "Quirks conocidos" de `CLAUDE.md`.
- **Historial multiplataforma:** ver/editar/eliminar una actividad ya finalizada es un dominio
  aparte (futuro `hooks/use-activities.js` + servicio real, patrón TanStack Query ya establecido
  en el proyecto), no depende de este módulo nativo ni de este store transitorio.
- **Gap de backend a abrir** (`docs/BACKEND_API_GAPS.md`, tarea del plan de implementación, no de
  esta spec): contrato borrador para persistir la actividad finalizada (ejercicios, series, estado
  por serie — completado/skippeado/terminado —, tiempos, puntos GPS) y para el historial
  (listar/editar/eliminar). Se abre para discusión con backend, no se cierra en este documento.

## Testing

Jest sobre `utils/session-start-window.js` (puro, sin fetch ni sensores). Sin tests de render
(convención del proyecto). Verificación visual del flujo de navegación: manual, en dispositivo
real — no hay preview posible para esto (Platform-gated a nativo).

## Explícitamente fuera de alcance de esta spec

Cronómetro, GPS, pausas/skip con hold-to-confirm, notificación persistente, pantalla de resumen,
guardado, historial, asistencia/QR, monitoreo en tiempo real, banner del home. Todo esto lo retoma
el compañero (o una spec futura) sobre estos cimientos.
