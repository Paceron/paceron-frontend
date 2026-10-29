# Design

## Context

Estado actual que condiciona el diseño. La motivación está en `proposal.md` — Why.

**Lo que ya existe y se reutiliza:**

- `AuthenticatedHomeScreen` ya tiene un bloque `activeRole === 'runner'` con
  `StreakBanner` y `AchievementHighlightCard`. La tarjeta nueva se suma al final
  de ese bloque; no hace falta tocar el layout ni el guard.
- El Home ya usa `usePullToRefresh` con una lista de `invalidateQueries`. La
  tarjeta se engancha a esa misma lista para que el gesto refresque también sus
  KPIs.
- `DashboardLoadingOverlay` monta `assets/paceron-runner-waiting.gif`, el texto
  `Cargando métricas…` y una capa `absolute inset-0` con `pointerEvents: auto`.
  Es exactamente el loading pedido y ya está probado en el dashboard.
- `utils/dashboard-format.js` resuelve velocidad (`km/h`) y tiempo (`ms`) con
  locale `es-AR` y `null → "—"`.
- `utils/date-field-format.js` expone `fromISODate`, que convierte
  `YYYY-MM-DD` a `DD/MM/YYYY`.
- `utils/dashboard-error-codes.js` clasifica el error en reintentable o no, y
  `hooks/use-dashboard-query.js` ya expone `dashboardRetry` con esa regla.
- El patrón de servicio (`services/dashboard.js`) y de hook con TanStack Query
  (`hooks/use-dashboard-summary.js`) está establecido.

**Lo que NO se reutiliza:**

- `useDashboardSummary` y el resto de los hooks del dashboard: exigen `teamId`,
  aplican el scope del equipo y comparten un `scope` con filtros que el Home no
  tiene. Reusarlos obligaría a inventar un `team_id`.
- `DASHBOARD_METRIC_QUERY_OPTIONS` (`keepPreviousData`): está pensado para que un
  cambio de filtro no borre los números de la misma vista. Entre pestañas
  mostraría los números de otra pestaña, que es un dato incorrecto.
- `formatMetric(value, 'm')`: siempre escribe metros. La regla del Home pide
  metros hasta 999 y km desde 1000, así que la distancia necesita su propia
  función de presentación.

## Goals / Non-Goals

**Goals:**

- Una tarjeta aditiva al final del Home, solo para corredores.
- Período y pestaña como estado local; una request por combinación.
- Loading, error y vacío explícitos, reutilizando piezas existentes.
- Formato y títulos en funciones puras, testeables sin render.
- Cero cambios de comportamiento en el Home y en el dashboard actuales.

**Non-Goals:**

- No se agrega navegación de fechas (mes anterior, próxima semana).
- No se agregan gráficos, exportación, comparación de períodos ni deep links.
- No se calcula ni se corrige ninguna métrica en el front.
- No se toca `components/dashboard/` ni `services/dashboard.js`.

## Decisions

### D1: La tarjeta es un componente nuevo al final del bloque runner

`AuthenticatedHomeScreen` monta `<RunnerKpisCard />` después de
`AchievementHighlightCard`, dentro del fragment que ya existe para
`activeRole === 'runner'`:

```jsx
{activeRole === 'runner' && (
  <>
    <StreakBanner />
    <AchievementHighlightCard />
    <RunnerKpisCard />
  </>
)}
```

No se mueve, envuelve ni condiciona ningún componente previo. Si
`AchievementHighlightCard` no renderiza nada por falta de logros, la tarjeta
sigue apareciendo al final: no depende de que el logro exista.

El margen superior se resuelve dentro de la tarjeta, para no alterar el espaciado
de los componentes anteriores.

### D2: Archivos nuevos y una sola responsabilidad por archivo

| Archivo | Responsabilidad |
|---|---|
| `components/home/runner-kpis-card.jsx` | Estado de período/pestaña, hook, tabla, loading y estados |
| `hooks/use-runner-kpis.js` | Query de TanStack, key y política de reintento |
| `services/runner-kpis.js` | Request `GET /dashboard/runner-kpis` y rama de mocks |
| `services/__mocks__/runner-kpis-mock.js` | Respuesta de demo derivada del seed del dashboard |
| `utils/runner-kpis.js` | Tabs, filas, título del período, formatos y key pura |
| `__tests__/runner-kpis.test.js` | Título, tabs, filas y formatos |
| `__tests__/runner-kpis-service.test.js` | Parámetros de la request y query key |

El servicio va aparte de `services/dashboard.js` para que el módulo del
dashboard no gane una dependencia del Home ni cambie su batería de tests.

### D3: El período es estado local, con fecha de referencia del dispositivo

La tarjeta arranca con `period: 'month'` y `tab: 'general'`. La fecha de
referencia se calcula una vez al montar, con la fecha local del dispositivo, y se
convierte a ISO `YYYY-MM-DD` en el borde de la request.

`reference_date` NO se reutiliza de `from`/`to` de la respuesta: el servidor
deriva `from`/`to` justamente a partir de esa fecha, así que la fuente es el
dispositivo. Si el Home queda montado y cruza la medianoche, el período no cambia
hasta el próximo montaje o refresh; es aceptable para una tarjeta de consulta y
evita un timer que nadie necesita.

El selector `Mes`/`Semana`/`Día` no navega fechas: cambia el tipo de período
sobre la fecha actual. El título se arma con `from`, `to` y `days_considered` de
la respuesta, no con un cálculo local:

- `month` → `Octubre 2026 · 31 días considerados`
- `week` → `26/10/2026 al 01/11/2026 · 7 días considerados`
- `day` → `28/10/2026 · 1 día considerado`

El nombre del mes sale de una tabla `MONTHS_ES` en `utils/runner-kpis.js` y no de
`Intl.DateTimeFormat`: el locale de Hermes puede devolver `octubre de 2026` en
minúscula y con preposición, y el título es un texto de producto que no debe
depender de la implementación de `Intl` del dispositivo. La tabla se indexa con
el mes de `from`, que el backend ya normalizó al día 1 del mes calendario.

### D4: Una query por pestaña, sin `keepPreviousData` entre pestañas

El hook recibe `{ period, referenceDate, tab }` y ejecuta una sola query:

```js
['runner-kpis', period, referenceDate, tab]
```

Reglas:

- `staleTime: 0`: al volver a una pestaña ya vista, TanStack muestra el dato
  cacheado y revalida en segundo plano, como pide la spec.
- `retry: dashboardRetry`: no reintenta `400` ni `401`; sí red/`5xx`.
- Sin `placeholderData: keepPreviousData`: al cambiar de pestaña la query nueva
  no hereda los números de la anterior. Solo se conserva el dato de la misma
  combinación período+fecha+pestaña.
- Al tocar una pestaña, el handler setea `tab` y, si ya era la activa, llama a
  `refetch()` para cumplir “cada selección ejecuta su consulta”.
- Al cambiar de período, `period` entra en la key y la pestaña activa se vuelve a
  pedir sola; no se resetea la pestaña elegida.
- `enabled` queda siempre en `true`: el backend identifica al corredor por el
  token y no hace falta un id previo. La tarjeta ya está dentro del guard de
  `runner`.

### D5: El loading cubre solo la tarjeta y reutiliza el GIF existente

La tarjeta se renderiza con un contenedor `relative`. El estado de carga monta
`DashboardLoadingOverlay visible`, que es una capa `absolute inset-0` con
`pointerEvents: 'auto'` y `zIndex: 50`: cubre el contenido y las pestañas de la
tarjeta, y no bloquea el resto del Home.

Se muestra cuando `isLoading` es verdadero, o sea cuando no hay dato para esa
combinación. Una revalidación con datos cacheados (`isFetching && !isLoading`) NO
monta la capa; se muestra un texto discreto de actualización para no tapar
números válidos.

No se crea un spinner, un GIF ni un texto nuevos. La tarjeta no redefine el
asset: lo importa el overlay existente.

### D6: Formato puro, con una excepción explícita para la distancia

`utils/runner-kpis.js` expone:

- `buildPeriodTitle({ period, from, to, daysConsidered })`;
- `RUNNER_KPI_TABS` (orden, label y `tab` del contrato);
- `RUNNER_KPI_ROWS` (label, campo y tipo de formato por pestaña);
- `formatRunnerKpiValue(field, value)`;
- `formatDistanceM(value)`;
- `runnerKpisQueryKey({ period, referenceDate, tab })`.

Formatos:

| Magnitud | Función | Regla |
|---|---|---|
| Distancia | `formatDistanceM` | `< 1000` → metros enteros; `>= 1000` → km con un decimal |
| Velocidad | `formatMetric(value, 'km/h')` | un decimal |
| Tiempo | `formatMetric(value, 'ms')` | `formatClock`: `m:ss` o `h:mm:ss` |
| Fecha | `fromISODate` | `DD/MM/YYYY` |
| Ausencia | `formatMetric` / `EMPTY_METRIC` | `—` |

`null` se evalúa antes de formatear y NUNCA se convierte a `0`. Un `0` real se
muestra como `0 m`, porque `formatMetric` ya distingue `null` de `0`.

El redondeo de km se delega a `Intl.NumberFormat('es-AR')` dentro de
`formatMetric`; la función de distancia solo decide la unidad y reutiliza el
mismo formateador para no mezclar comas y puntos en la misma tabla.

### D7: Estados de error y vacío explícitos

- **Red/5xx:** mensaje breve y botón `Reintentar` que llama a `refetch()` de la
  combinación activa.
- **`400`:** mensaje sin botón. El front solo envía valores del contrato, así que
  este estado es una red de seguridad; reintentar la misma request volvería a
  fallar.
- **`401`:** no se maneja en la tarjeta; lo resuelve el flujo global de sesión
  del repo.
- **`has_data=false`:** se muestran las filas con `—`, la nota
  `Sin datos en este período.` y las pestañas siguen visibles. La tarjeta no
  desaparece ni deja el Home con un hueco.

La clasificación usa `resolveDashboardError(error).retryable` de
`utils/dashboard-error-codes.js`, la misma fuente que ya usa el dashboard, para
no repetir la regla de qué status se reintenta.

### D8: Las pestañas y la tabla tienen semántica accesible

- Cada pestaña es un `Pressable` con `accessibilityRole="tab"` —rol aceptado por
  Android, a diferencia de los roles web-only— y `accessibilityState={{ selected
  }}`. En web se agrega `role="tab"` crudo para que el navegador exponga el
  tablist.
- El contenedor de pestañas usa `accessibilityRole="tablist"` solo en web; en
  nativo se omite porque no es un rol del delegate de Android.
- La tabla usa `View` con `accessibilityRole="row"`/`"cell"` solo en web; en
  nativo cada fila es un `Text` con `accessibilityLabel` que une label y valor,
  para que el lector anuncie `Distancia recorrida: 12,4 km` de una sola vez.
- El selector de período usa el mismo patrón de tabs, con tres opciones y estado
  seleccionado.
- Todo elemento interactivo nuevo lleva `nativeID` y `testID`.
- Las pestañas van en un `ScrollView horizontal` con `showsHorizontalScrollIndicator={false}`
  para 360 px; la tabla no scrollea horizontal. La tarjeta respeta el
  `max-w-3xl` que ya aplica el contenedor del Home en web.

### D9: El mock de demo deriva del seed del dashboard

Con `USE_MOCKS=true` el Home ya funciona con mocks. Para que la tarjeta no sea la
única pieza que falla en ese modo, `mockGetRunnerKpis` reutiliza
`__getMockDashboardSeed()` de `services/__mocks__/dashboard-mock.js`, filtra las
filas del `callerUserId` y aplica las mismas reglas de período y pestaña que el
backend. Si el usuario logueado no tiene filas sembradas, devuelve
`has_data=false`, que es un estado válido y visible.

No se agregan datos nuevos ni se toca el seed existente: el mock es una vista
más del mismo conjunto.

### D10: Pull-to-refresh e invalidación

`AuthenticatedHomeScreen` suma `['runner-kpis']` a las queries que invalida el
pull-to-refresh, dentro del mismo guard de `activeRole === 'runner'`. El prefijo
coincide con la key del hook, así que invalida todas las pestañas y períodos
cacheados. La pestaña activa se vuelve a pedir al quedar stale.

## API Contract

```http
GET /api/v1/dashboard/runner-kpis?period=month&reference_date=2026-10-28&tab=general
Authorization: Bearer <token>
```

La respuesta se consume tal cual la define el change `kpis-home-corredor` de
`paceron-backend`:

```json
{
  "period": "month",
  "reference_date": "2026-10-28",
  "from": "2026-10-01",
  "to": "2026-10-31",
  "days_considered": 31,
  "tab": "general",
  "units": { "distance": "m", "speed": "km/h", "time": "ms" },
  "has_data": true,
  "series_count": 42,
  "valid_series": 35,
  "sessions": 12,
  "metrics": {
    "total_distance_m": 84250.5,
    "best_day_distance_m": 12500,
    "best_day_date": "2026-10-12",
    "average_speed_kph": 10.8,
    "best_speed_kph": 16.4,
    "best_time_ms": null,
    "best_distance_m": null
  }
}
```

El front no envía `team_id`, `group_id` ni `athlete_user_id`, y no deriva
`from`/`to`: los muestra.

## Data Rules (presentación)

| Métrica | Campo | Formato |
|---|---|---|
| Distancia recorrida | `total_distance_m` | `850 m` / `84,3 km` |
| Mayor distancia en un día | `best_day_distance_m` | idem |
| Fecha del mejor día | `best_day_date` | `DD/MM/YYYY` |
| Mejor velocidad | `best_speed_kph` | `16,4 km/h` |
| Velocidad promedio | `average_speed_kph` | `10,8 km/h`; en `general`, solo ritmo continuo |
| Mejor tiempo | `best_time_ms` | `23:00` |
| Mayor distancia en un ejercicio | `best_distance_m` | `5,2 km` |

Las filas visibles por pestaña son las del spec. Una clave que no aplica a la
pestaña no se muestra aunque el backend la devuelva en `null`; una clave que
aplica y viene `null` se muestra con `—`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Cambiar de pestaña y ver por un instante los números de otra | No se usa `keepPreviousData` entre pestañas; la tabla solo pinta el `data` de la key activa |
| La capa de carga tapa el Home completo | El overlay se monta dentro del contenedor `relative` de la tarjeta y no en el `ScrollView` |
| La fecha local del dispositivo difiere de la del servidor | El front manda siempre su fecha local; el default del servidor es solo fallback |
| Cuatro requests al abrir el Home | Solo se pide `general`; las otras tres se piden al seleccionarlas |
| El título del mes cambia según `Intl` | Tabla `MONTHS_ES` propia y test de los doce meses |
| La tarjeta rompe el orden del Home | Se monta al final del fragment runner y se verifica que los tres componentes previos sigan en su lugar |
| Duplicar formato con el dashboard | Se reutilizan `formatMetric`, `formatClock`, `fromISODate` y `EMPTY_METRIC`; solo la distancia agrega la regla m/km |

## Testing Strategy

- **Utilidades puras:** los doce meses, febrero bisiesto, semana que cruza de
  mes, singular/plural de días, las cuatro pestañas y sus filas, `null` vs `0`,
  `850 → 850 m`, `12400 → 12,4 km`, time `1380000 → 23:00` y fecha.
- **Query key:** cambiar `period`, `referenceDate` o `tab` produce una key
  distinta; el prefijo es `runner-kpis` para que la invalidación lo alcance.
- **Servicio:** la URL es `/dashboard/runner-kpis`, incluye exactamente
  `period`, `reference_date` y `tab`, y no incluye ids de scope. Caso
  `USE_MOCKS=true` delega en el mock.
- **Mock:** devuelve las métricas de las filas del caller para la pestaña pedida
  y `has_data=false` cuando no hay filas.
- **Componente:** sin test de render, según la convención del repo. Verificación
  manual de orden en el Home, cambio de pestaña con loading, error con y sin
  reintento, vacío, teclado en web y 360 px.
- **Regresión:** `npm test` completo; el dashboard existente no cambia porque no
  se tocan sus archivos.
