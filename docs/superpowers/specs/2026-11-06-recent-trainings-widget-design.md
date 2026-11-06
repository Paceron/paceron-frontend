# Widget de entrenamientos recientes (Home) + mejora del historial

## Intención

El Home del corredor ya muestra sus competencias activas (`CompetitionsPreviewCard`).
Falta el equivalente para entrenamientos: un vistazo rápido a cómo le fue en sus
últimas corridas (presenciales o asíncronas) sin tener que entrar a Entrenamientos.

Se descartó explícitamente mezclar intentos de competencia en este widget — el
volumen de intentos puede ser mucho mayor al de entrenamientos y diluiría la
card. Las competencias ya tienen su propio widget; este es el de entrenamientos,
separado.

## Goals

- El corredor ve, sin salir del Home, sus últimas 3 sesiones de entrenamiento
  **finalizadas** (presencial o async), con distancia, duración y % de
  cumplimiento contra lo planificado.
- Click en una card → detalle completo de esa sesión
  (`/training-comparison/session`, ya existe).
- El historial de entrenamientos (`Entrenamientos > Historial`) gana distancia y
  duración por sesión — hoy no muestra ninguna de las dos.

## Non-goals

- Intentos de competencia no entran a este widget ni a este historial (decisión
  explícita del usuario, 2026-11-06).
- No se agrega badge presencial/async ni % de cumplimiento al historial de
  entrenamientos en esta rama — bloqueado por un campo faltante en el backend
  (ver "Gap a documentar" abajo). El widget del Home SÍ los muestra: su fuente
  de datos no tiene esa limitación.
- No se unifica la fuente de datos del historial de entrenamientos
  (`/workout-feedback/history`) con la de comparación
  (`/activities/comparison`) — son dos endpoints con propósitos distintos
  (edición/borrado de feedback vs. comparación de solo lectura) y unificarlos
  es un cambio de arquitectura mayor, fuera de alcance acá.

## Contexto técnico (ya confirmado, no a reinventar)

- **Fuente de datos del widget:** `useComparisonList` (`hooks/use-activity-comparison.js`),
  ya construida para la pantalla de comparación planificado vs realizado. Devuelve,
  por sesión, en una sola consulta: `sessionInstanceId`, `date`, `sessionName`,
  `teamName`, `isPresencial`, `status` (`finished | wip | interrupted | none`),
  `compliancePct`, y `totals.actualDurationMs` / `totals.actualDistanceM`. Sin
  trabajo de backend nuevo.
  - **Llamada exacta:** `useComparisonList({ dateFrom: hace90Días, dateTo: hoy })`
    — sin `teamId` ni `kind` (cross-equipo, todos los tipos), son opcionales
    en el hook. El widget NO lee `trainings-history-filters-store.js` ni
    ningún otro estado de filtro de otra pantalla — es una consulta propia,
    fija, independiente de cualquier filtro que el usuario haya dejado
    aplicado en `/training-comparison` o en el historial. `dateFrom`/`dateTo`
    en formato `'YYYY-MM-DD'`, mismo criterio que el resto de los call sites
    de este hook.
  - **Orden:** no asumir que `list.sessions` ya viene ordenado por fecha
    (el endpoint lo ordena por lo que pida la query, no necesariamente
    descendente) — `selectRecentFinishedTrainings` siempre ordena de nuevo
    del lado del cliente antes de cortar a 3, sin confiar en el orden de
    entrada.
  - **Loading/error:** igual que `CompetitionsPreviewCard` — mientras
    `loading` es true, o si la lista final queda vacía, el componente
    devuelve `null` (sin skeleton, sin mensaje de error propio). Mismo
    criterio ya establecido para los widgets del Home.
- **Formato de los números:** reusar `utils/comparison-format.js` tal cual —
  `formatCompliance`, `complianceTone`, `formatComparisonDate`, y
  `formatClock`/`formatMeters` (`utils/time.js` / `utils/distance.js`) para
  duración/distancia de `totals.actualDurationMs` / `totals.actualDistanceM`.
  No duplicar esta lógica en el widget.
- **Navegación al detalle:** `/training-comparison/session?sessionInstanceId=<id>`
  (`app/(tabs)/training-comparison/session.jsx` →
  `components/comparison/session-comparison-screen.jsx`, ya lee
  `sessionInstanceId` de la URL). No hace falta pasar `athleteUserId` — por
  default es el usuario logueado, que es siempre el caso acá.
- **Icono presencial/async:** mismo criterio que `next-training-banner.jsx`
  (mismo screen, arriba en el Home) — `map-marker-radius` para presencial,
  `run-fast` para async. Reusar, no inventar un nuevo ícono.
- **Dónde monta el widget:** `components/home/authenticated-home-screen.jsx`,
  dentro del bloque `activeRole === 'runner'`, inmediatamente después de
  `<CompetitionsPreviewCard />`.
- **Historial de entrenamientos, fuente de distancia/duración:** cada item de
  `/workout-feedback/history` (`toWorkoutFeedbackHistoryItemModel`,
  `services/normalizers.js`) YA trae `durationMs`/`distanceMeters` por serie.
  `utils/trainings-history-grouping.js#groupHistoryItemsBySession` agrupa por
  sesión pero hoy solo cuenta series completadas/salteadas — sumar
  `durationMs`/`distanceMeters` ahí es una extensión directa, sin fetch nuevo.

## Decisiones ya tomadas (no volver a preguntar)

- **Cantidad:** las 3 sesiones más recientes.
- **Filtro:** solo `status === 'finished'`. `wip`/`interrupted`/`none` quedan
  afuera — una sesión a medio hacer no tiene números finales que mostrar.
- **Ventana de consulta:** 90 días hacia atrás desde hoy (el endpoint admite
  hasta 366 días de rango; 90 es margen de sobra para encontrar 3 finalizadas
  sin pedir el máximo). Si no hay 3 finalizadas en la ventana, se muestran las
  que haya.
- **Sin actividades finalizadas en la ventana:** el widget no se monta (devuelve
  `null`), mismo criterio que `CompetitionsPreviewCard`.
- **"Ver historial"** navega a la pestaña Historial de Entrenamientos
  (`/calendar` con `activeTab: 'historial'` vía `useCalendarTabStore`, mismo
  mecanismo que ya usa esa pestaña hoy) — no a `/training-comparison`. Ese
  último es la pantalla de comparación/analítica, no el historial que el
  corredor ya conoce para revisar/editar sus sesiones.

## Archivos a crear/tocar

- **Crear** `utils/recent-trainings.js`: función pura
  `selectRecentFinishedTrainings(sessions, limit = 3)` — filtra `status === 'finished'`,
  ordena por `date` descendente, corta a `limit`. Con test unitario
  (`__tests__/recent-trainings.test.js`), mismo patrón que `competition-sort.js`.
- **Crear** `components/home/recent-trainings-card.jsx`: mirror estructural de
  `components/home/competitions-preview-card.jsx` (`PreviewBox`/`ViewAllTile`
  → acá una sola lista de hasta 3 filas, sin fila "wide"/"narrow" en columnas
  separadas — una lista vertical simple basta, no hay necesidad de replicar el
  layout de 2+1 cajas de competencias). Cada fila: fecha, nombre de sesión,
  equipo, ícono presencial/async, distancia, duración, badge de % de
  cumplimiento coloreado por `complianceTone`. Trailing chevron. Al pie, link
  "Ver historial".
- **Modificar** `components/home/authenticated-home-screen.jsx`: importar y
  montar `<RecentTrainingsCard />` después de `<CompetitionsPreviewCard />`.
- **Modificar** `utils/trainings-history-grouping.js`:
  `groupHistoryItemsBySession` suma `durationMs`/`distanceMeters` de los items
  del grupo (ignorando nulls) en dos campos nuevos, p.ej. `totalDurationMs`/
  `totalDistanceMeters`. Actualizar `__tests__/trainings-history-grouping.test.js`
  si existe, o crearlo si no.
- **Modificar** `components/calendar/trainings-history-row.jsx`: mostrar
  `totalDurationMs`/`totalDistanceMeters` (con `formatClock`/`formatMeters`) en
  la fila de meta, junto a team/group — solo si > 0 (una sesión sin ninguna
  serie con esos datos no muestra nada, no "0:00 · 0 m").

## Gap a documentar (`docs/BACKEND_API_GAPS.md`)

`GET /users/{id}/workout-feedback-history` y su par `/administered-workout-feedback-history`
(`services/trainingsHistory.js`) no incluyen `is_presencial` por item/sesión.
Sin ese campo no se puede mostrar un badge presencial/async en el historial de
entrenamientos, ni cruzar con lo planificado para traer `compliance_pct` sin
pegarle a un segundo endpoint (`/activities/comparison`, que sí tiene el
campo). Pedido: sumar `is_presencial` a la respuesta de esos dos endpoints. Sin
esto, el historial de entrenamientos se queda con distancia/duración nomás;
compliance% y el badge quedan reservados al widget del Home (que sí tiene la
fuente completa).

## Testing

- `utils/recent-trainings.js`: unitario, puro.
- `groupHistoryItemsBySession` extendido: unitario, casos con/sin
  duración/distancia en los items, suma correcta.
- Sin tests de render de componente (convención del repo) — verificación visual
  manual del widget y de las filas de historial actualizadas.

## Lo que queda a criterio del implementador

- Textos exactos de la card (títulos, kicker) — seguir el tono ya establecido
  por `CompetitionsPreviewCard`/`StreakBanner` (kicker chico uppercase, nada
  nuevo que inventar).
- Orden interno de los datos dentro de cada fila (distancia antes o después de
  duración) — cualquier orden consistente con el resto de la app
  (`totalsDurationLabel`/`totalsDistanceLabel` en `comparison-format.js` ya
  van duración-primero, seguir ese orden por consistencia).
