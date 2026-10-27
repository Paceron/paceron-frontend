# Leaderboard con subpestañas por métrica — diseño

**Fecha:** 2026-10-24
**Rama:** `feature/route-competitions-polish`
**Pedido original:** "mejorar la pestaña de leaderboard para tener subpestañas como las de
competencias, donde cada subpestaña es una metrica para la que se puede ver el top y seleccionar
el periodo de tiempo dentro del mismo header con las subpestañas... en caso de rango de fechas
personalizado desplegar un modal para cargar fecha desde y hasta en lugar de ubicar los inputs
inline."

## Contexto

`components/team/leaderboard-tab.jsx` muestra hoy las 6 métricas de gamificación (Gap 32,
`utils/gamification-metric-options.js#METRIC_OPTIONS`) como 6 secciones (`MetricSection`) siempre
montadas y colapsables, cada una con su **propio** estado de período (`week|month|year|custom|all`)
y, si `period==='custom'`, dos `DateField` inline (Desde/Hasta) que aparecen al lado del selector
de período.

Esto se decidió así en 2026-10-15 porque en ese momento no existía otro patrón de navegación por
pestañas en el repo. Desde entonces `components/team/competitions-tab.jsx` adoptó subpestañas por
estado (`TabBar` de `components/shared/tab-bar.jsx`, `variant="compact"`) para su propia lista, y
el pedido actual es aplicar el mismo patrón acá: una subpestaña por métrica, con el período como
control **global** (confirmado con el usuario: "Global, compartido entre subpestañas" — un único
período aplica a la métrica que esté activa en cada momento, cambiar de métrica no resetea el
período elegido).

**Fuera de alcance:** el backlog separado "Leaderboard full-ranking modal" (ver more abajo) sigue
bloqueado por la falta de un parámetro `?limit=` en el Gap 32 real — no se toca en este diseño.
Tampoco se tocan las mejoras de GPS (próximo ítem en el roadmap de la rama, después de este).

## Objetivo

- Reemplazar las 6 secciones apiladas por una sola vista activa a la vez, navegable por
  subpestañas (una por métrica), mismo componente `TabBar` que ya usa Competencias.
- El selector de período vive en la MISMA fila que las subpestañas (no debajo, no por sección).
- Rango personalizado: en vez de los 2 `DateField` inline de hoy, un modal dedicado con
  Desde/Hasta + Cancelar/Aplicar.
- Simplificar el fetching: hoy se disparan 6 queries de leaderboard en simultáneo (una por
  sección, todas montadas); con subpestañas solo se pide la métrica activa.

## No-objetivos

- No cambia el contrato de `GET /teams/{id}/leaderboard` ni `hooks/use-team-leaderboard.js` más
  allá de los parámetros que ya recibe.
- No agrega el modal de "ranking completo" (backlog aparte, bloqueado por backend).
- No toca el récord histórico (`period=all`) más allá de preservar su tratamiento visual actual
  (fila 1 = récord, estilo ámbar).

## Arquitectura

### Estado, antes y después

**Antes** (por sección, × 6): `expanded`, `period`, `fromDate`, `toDate`.

**Después**, a nivel de `LeaderboardTab` (uno solo, compartido):
- `activeMetric` — id de `METRIC_OPTIONS`, default `METRIC_OPTIONS[0].id` (`'distance'`).
- `period` — default `'month'`, igual que hoy.
- `fromDate` / `toDate` — strings en formato de `DateField` (`DD/MM/YYYY`), vacíos por default.
- `rangeModalVisible` — boolean, controla el modal de rango personalizado.
- `periodBeforeCustomRef` (`useRef`) — período justo antes de abrir el modal; si el usuario
  cancela sin aplicar, se restaura este valor (ver "Interacción: abrir/cancelar/aplicar" abajo).

`expanded` desaparece — no hay nada que colapsar cuando solo una métrica está visible a la vez.

### Layout del header

Mismo patrón de fila que `competitions-tab.jsx:482-491` (`flex-row items-start justify-between`,
`TabBar` a la izquierda envuelta en `flex-1`, control secundario a la derecha):

```
[ TabBar: Distancia | Tiempo | Ritmo | Vel. pico | Entrenamientos | Asistencias ]   [ Período ▾ ]
```

`TabBar` necesita `tabs: [{id, icon, label}]`. `METRIC_OPTIONS` hoy es `{id, name}` — se le agrega
un campo `icon` (nombre de ícono de `MaterialCommunityIcons`) a cada entrada; `name` se mapea a
`label` al construir el array que recibe `TabBar`. Este agregado no afecta al otro consumidor de
`METRIC_OPTIONS` (`create-competition-modal.jsx`, que solo lee `id`/`name` para su
`ResponsiveSelectField`).

Íconos propuestos (sin precedente fuerte en el repo para estas métricas puntuales, elegidos por
asociación directa):
- `distance` → `map-marker-distance`
- `duration` → `clock-outline`
- `pace` → `speedometer`
- `peak_speed` → `flash`
- `sessions_count` → `run`
- `attendance_count` → `account-check-outline`

El selector de período (`ResponsiveSelectField`, mismas opciones de `PERIOD_OPTIONS` que hoy) se
ubica a la derecha de la fila, con el mismo tratamiento `plain`/`dense`/`hideErrorRow` que ya usa.

**Rango personalizado activo:** cuando `period === 'custom'`, debajo de la fila del header (no
adentro, para no competir por espacio con las subpestañas) se muestra un chip de solo lectura con
el rango elegido y un ícono de lápiz para reabrir el modal:

```
📅 01/09/2026 – 30/09/2026  ✎
```

Si `period==='custom'` pero todavía no hay rango confirmado (caso: se acaba de seleccionar
"Rango personalizado" y el modal está abierto por primera vez, sin Aplicar todavía), el chip no se
muestra — nada que mostrar aún.

### El modal (`LeaderboardDateRangeModal`, nuevo componente)

Mismo patrón visual/estructural que el resto de modales del repo (backdrop `Pressable` con
`onPress` = cerrar, card `Pressable` no-op para frenar propagación, `nativeID` `*-modal-backdrop`
para que `local/require-modal-backdrop-close` lo reconozca):

- Dos `DateField` (Desde / Hasta), reusando el mismo componente de `components/forms/fields.jsx`
  que hoy usan los inline.
- Botón **Cancelar** — cierra sin aplicar. Restaura `period` al valor que tenía antes de abrirse
  el modal (ver abajo) y no modifica `fromDate`/`toDate`.
- Botón **Aplicar** — deshabilitado hasta que ambas fechas estén completas y `Desde <= Hasta`
  (comparación lexicográfica de ISO vía `toISODate`, ya existente en
  `utils/date-field-format.js`). Si `Desde > Hasta`, un texto de error inline indica el problema
  (mismo criterio de UX que cualquier form del repo, sin necesidad de un validador nuevo en
  `utils/` — es una comparación de una línea, no amerita su propio archivo+test, YAGNI).
- Al abrir, las dos fechas se siembran con los valores actuales de `fromDate`/`toDate` del padre
  (si ya había un rango elegido antes, aparece precargado al reabrir con el lápiz) — estado local
  del modal, sembrado una vez por apertura (mismo criterio que el reset-on-reopen de
  `create-competition-modal.jsx`).

**Props:** `visible`, `initialFrom`, `initialTo`, `onCancel`, `onConfirm(from, to)` — componente de
presentación puro, sin acceso a stores ni queries.

### Interacción: abrir/cancelar/aplicar

1. Usuario cambia el selector de período a `'custom'` (desde cualquier otro valor):
   `periodBeforeCustomRef.current` guarda el período anterior, `setPeriod('custom')`,
   `setRangeModalVisible(true)`.
2. Usuario toca el lápiz del chip (rango ya confirmado antes): `periodBeforeCustomRef.current =
   'custom'` (no-op, ya estaba en custom), `setRangeModalVisible(true)`.
3. **Cancelar:** `setRangeModalVisible(false)`, `setPeriod(periodBeforeCustomRef.current)`. En el
   caso 1 esto vuelve al período previo (el usuario nunca llega a pedir datos con `custom` sin
   rango). En el caso 2 es un no-op sobre `period` — el chip y el rango confirmado quedan como
   estaban.
4. **Aplicar:** `setFromDate(from)`, `setToDate(to)`, `setRangeModalVisible(false)`. `period`
   queda en `'custom'` (ya lo estaba desde el paso 1 o 2).

Este único mecanismo cubre los dos triggers (selección fresca del dropdown y reapertura por
lápiz) sin lógica condicional adicional.

### Data fetching

Un solo `useTeamLeaderboard(teamId, { metric: activeMetric, period, from, to })` a nivel de
`LeaderboardTab` (antes: 6 instancias, una por sección montada). `from`/`to` solo se pasan cuando
`period==='custom'` y ambas fechas están seteadas — mismo criterio que hoy
(`period === 'custom' && fromDate ? toISODate(fromDate) : undefined`).

Efecto colateral positivo: TanStack Query cachea por `['leaderboard', teamId, metric, period,
from, to]` — cambiar de subpestaña y volver a una métrica ya vista en la misma combinación de
período no vuelve a pedir red, usa caché.

### Cuerpo de la vista activa

La lógica actual de `MetricSection` para construir `visibleRows` (histórico → fila 1 = récord con
estilo ámbar + filas 2-5 normales; resto de períodos → `rows` tal cual + fila propia si el viewer
no está en el top 5) se preserva **sin cambios de comportamiento**, solo se mueve de "una función
por sección, 6 veces" a "una vez, para la métrica activa". No se extrae a un archivo separado — es
lógica acoplada 1:1 a esta pantalla, extraerla sería una abstracción sin otro consumidor (YAGNI).

`LeaderboardRow` y `RankBadge` no cambian.

### Qué se elimina

- `MetricSection` como componente con estado propio — su lógica de render se inlinea en
  `LeaderboardTab`.
- El botón de colapsar/expandir (`IconTooltip` + chevron) — sin otras secciones compitiendo por
  espacio, no hay nada que colapsar. `IconTooltip` se reutiliza para el ícono de lápiz del chip de
  rango (mismo componente, nuevo uso).
- Los 2 `DateField` inline — reemplazados por el modal.

## Archivos afectados

- **Modificar** `components/team/leaderboard-tab.jsx` — reestructura completa del componente
  (estado global, header con `TabBar`+período, chip de rango, render de la métrica activa).
  Quedan: `LeaderboardRow`, `RankBadge`, `PERIOD_OPTIONS` (sin cambios).
- **Crear** `components/team/leaderboard-date-range-modal.jsx` — el modal nuevo.
- **Modificar** `utils/gamification-metric-options.js` — agregar campo `icon` a cada entrada de
  `METRIC_OPTIONS`.

No se tocan `hooks/use-team-leaderboard.js`, `services/leaderboard.js`, `services/normalizers.js`
(`toLeaderboardModel`), ni `utils/leaderboard-metric-format.js`.

## Testing

Este es un cambio de estructura de UI/interacción, no de lógica pura nueva — consistente con la
convención del repo (`CLAUDE.md`, sección Testing: no hay tests de render de componentes, los
visuales se verifican a mano en preview). No se agrega ningún archivo a `__tests__/` para esta
rama del trabajo. La única pieza con alguna condición (`Desde <= Hasta` del modal) es una
comparación de una línea sin casos de borde no triviales — no amerita extraerse a un util con test
dedicado.

Verificación manual en preview (web) antes de dar por terminado:
- Cambiar de subpestaña preserva el período elegido (ej. elegir "Último año" en Distancia, pasar a
  Ritmo, confirmar que sigue en "Último año").
- Elegir "Rango personalizado" abre el modal; Cancelar sin tocar nada vuelve al período anterior
  (confirmar que NO queda trabado en "custom" sin chip).
- Aplicar con fechas válidas cierra el modal, muestra el chip, y el leaderboard de la métrica
  activa refleja ese rango.
- Reabrir el chip con el lápiz precarga las mismas fechas ya elegidas.
- Intentar Aplicar con `Desde > Hasta` o con algún campo vacío mantiene el botón deshabilitado /
  muestra el error.
- Histórico (`period='all'`) sigue mostrando la fila 1 con estilo de récord ámbar, igual que hoy.
- Mobile (preview resize o dispositivo): `TabBar` scrollea horizontal igual que en Competencias,
  sin romper layout.

## Referencias

- Patrón de subpestañas: `components/team/competitions-tab.jsx:482-491`,
  `components/shared/tab-bar.jsx`.
- Convención de modales (backdrop/card, cierre al click afuera): `CLAUDE.md`, sección "Modales".
- Gap 32 (contrato de backend del leaderboard): `docs/BACKEND_API_GAPS.md`, línea 1316 en
  adelante. Sin `?limit=` — por eso el backlog de "ranking completo" sigue fuera de alcance.
