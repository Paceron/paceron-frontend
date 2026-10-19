# Gamificación — Spec 3: Leaderboards

> Tercera de 4 specs del módulo de gamificación, sobre `feature/gamification` (Specs 1 y 2 ya
> mergeadas en esa rama). Fuente: doc maestro de gamificación (usuario, 2026-10-12) +
> `docs/BACKEND_API_GAPS.md` Gap 32 (consenso con backend 2026-10-13, con corrección de encoding
> aplicada 2026-10-14: `value` siempre número plano en la unidad fijada por métrica). A diferencia
> de Specs 1/2, esta vive en `team-detail-screen.jsx`, no en el hub de Logros.

## Alcance

Incluye: pestaña "Leaderboard" en la vista de equipo, selector de métrica + período, top 5 +
fila propia cuando no está en el top 5, récord del equipo en modo histórico, desempate (resuelto
server-side, el frontend solo lo muestra), estados de carga/error/vacío, pull-to-refresh.

Fuera de alcance (Spec 4, misma rama): competencias. Fuera de alcance permanente (señalado en el
doc fuente): leaderboards local/regional/nacional, leaderboards de entrenadores.

## Backend

`GET /teams/{id}/leaderboard?metric=distance|duration|pace|peak_speed|sessions_count|attendance_count&period=week|month|year|custom|all&from=&to=`
→ `{rows: [{user_id, name, avatar_url, value, rank}], viewer_rank: {user_id, value, rank} | null,
record?: {user_id, name, value, achieved_at}}`. `rows` = top 5. `viewer_rank` = posición del
usuario autenticado aunque no esté en el top 5 (`null` si el viewer es entrenador). `record` solo
con `period=all`. `value` siempre número plano (Gap 32, corrección 2026-10-14): `distance`→metros,
`duration`→milisegundos, `pace`→minutos/km decimal, `peak_speed`→km/h decimal,
`sessions_count`/`attendance_count`→entero. Desempate server-side.

## Archivos

**Nuevos:**
- `services/leaderboard.js` — `getTeamLeaderboard(teamId, {metric, period, from, to})`.
- `services/__mocks__/leaderboard-mock.js` — fixture con 7 filas simuladas (para poder ver tanto
  el top 5 como un `viewer_rank` fuera de él), valores plausibles por métrica, y un `record` fijo
  para el modo histórico.
- `services/normalizers.js` — agrega `toLeaderboardModel(dto)` (snake→camel).
- `hooks/use-team-leaderboard.js` — `useTeamLeaderboard(teamId, {metric, period, from, to})`:
  TanStack Query, `queryKey: ['leaderboard', teamId, metric, period, from, to]`.
- `utils/leaderboard-metric-format.js` — `formatMetricValue(metric, value)`: `distance` vía
  `formatMeters` (existente), `duration` vía `formatClock` (existente), `pace` → `mm:ss /km`
  (función propia, ya que ninguna util existente formatea minutos decimales), `peak_speed` →
  `X.X km/h`, `sessions_count`/`attendance_count` → `${value}`. Testeada en
  `__tests__/leaderboard-metric-format.test.js`.
- `components/team/leaderboard-tab.jsx` — pestaña completa: selector de métrica + período
  (`Row`/`Col` + `ResponsiveSelectField`, mismo patrón de forms del repo), 2 `DateField` cuando
  `period === 'custom'`, lista de filas (medalla puestos 1-3, número 4-5+), fila propia con estilo
  de acento si no está en el top 5, fila de récord cuando `period === 'all'`.
- `utils/leaderboard-rank-meta.js` — `rankMeta(rank)` → `{icon, color} | null` (medalla para
  1/2/3, `null` para el resto — la fila muestra el número plano en ese caso). Testeada en
  `__tests__/leaderboard-rank-meta.test.js`.

**Tocados:**
- `components/team/team-detail-screen.jsx` — `TABS` suma `{id: 'leaderboard', label:
  'Leaderboard', icon: 'podium-gold'}` entre `grupos` y `solicitudes`, SIN entrar en el filtro de
  `visibleTabs` (visible para corredor y entrenador siempre, a diferencia de `grupos`/
  `solicitudes` que sí filtran por rol). El `usePullToRefresh` del screen suma
  `queryClient.invalidateQueries({queryKey: ['leaderboard', teamId]})` a su `Promise.all` (el
  prefijo de key sin métrica/período invalida todas las variantes cacheadas, comportamiento
  default de TanStack Query).

## Copy de los selectores

| Métrica (`metric`) | Label |
|---|---|
| `distance` | Distancia |
| `duration` | Tiempo de entrenamiento |
| `pace` | Mejor ritmo |
| `peak_speed` | Velocidad pico |
| `sessions_count` | Entrenamientos realizados |
| `attendance_count` | Asistencias |

| Período (`period`) | Label |
|---|---|
| `week` | Última semana |
| `month` | Último mes |
| `year` | Último año |
| `custom` | Rango personalizado |
| `all` | Histórico |

## Selección de período personalizado

El selector de período ofrece "Última semana" / "Último mes" / "Último año" / "Rango
personalizado" / "Histórico". Con "Rango personalizado" aparecen 2 `DateField`
(`components/forms/fields.jsx`, ya existente) — "Desde"/"Hasta". El valor de `DateField` es
`DD/MM/YYYY` (confirmado en CLAUDE.md, resuelto 2026-10-04); se convierte a `YYYY-MM-DD` con
`utils/date-field-format.js#toISODate` (existente) antes de mandarlo como `from`/`to` al backend.
Para `week`/`month`/`year`/`all` no se manda `from`/`to` — el backend resuelve la ventana.

## UX / UI

- Fila de selector arriba de todo, `Row`/`Col` (2 columnas en web, apilado en mobile — convención
  de forms del repo).
- Top 5: cada fila con medalla (1-3) o número (4-5), avatar (`AvatarPicker` en modo solo-lectura,
  sin `onPick`/`onRemove` — ya soporta ese modo), nombre, valor formateado.
- Fila propia: mismo layout, con `border-l-4 border-primary` o fondo tintado para distinguirse,
  **debajo** del top 5 cuando el puesto real es >5 (si ya está en el top 5, no se duplica la fila
  — se reconoce por `user_id` coincidente). No se muestra para el entrenador (`viewer_rank: null`).
- Récord del equipo (solo `period === 'all'`): fila destacada aparte, con `achieved_at` formateado.
- Estados de carga/error/vacío explícitos (equipo sin datos para esa métrica/período: mensaje
  claro, nunca una pantalla en blanco — mismo criterio que el resto del repo).
- Pull-to-refresh ya cubierto por el `RefreshControl` existente del screen (mobile) — esta
  pestaña no agrega uno propio, solo se suma a la invalidación.

## Estilos

- Medalla puesto 1: ícono `medal` dorado (`#eab308`). Puesto 2: `medal` plata (`#94a3b8`). Puesto
  3: `medal` bronce (`#b45309`). Puesto 4+: círculo con el número, sin ícono.
- Valores formateados con los utils existentes (`formatMeters`, `formatClock`) más el formatter
  nuevo de pace/peak_speed — nunca un `Intl.NumberFormat`/cálculo ad-hoc inline en el componente.
- Fila propia: borde/fondo de acento (`border-l-4 border-primary`, `bg-primary-tint-subtle
  dark:bg-primary/10` — mismo patrón ya usado para la pestaña activa en `TabBar`).

## Responsive / plataformas

Selector de métrica/período apilado en mobile, en fila en web (`Row`/`Col`, ya responsive por
diseño). Lista de filas funciona a cualquier ancho sin cambios adicionales (es una columna simple).

## Testing

- `__tests__/leaderboard-metric-format.test.js` — las 6 métricas, valores típicos + bordes
  (`null`/`undefined` → `'—'` mismo criterio que `formatMeters`).
- `__tests__/leaderboard-rank-meta.test.js` — puestos 1/2/3 con medalla, 4+ sin medalla (`null`).
- `__tests__/leaderboard-mock.test.js` — forma del mock (al menos 7 filas, `record` presente).
- Sin tests de render de componentes (convención del repo).

## Identificadores

Todo componente visual nuevo lleva `nativeID`/`testID` kebab-case (regla obligatoria).
