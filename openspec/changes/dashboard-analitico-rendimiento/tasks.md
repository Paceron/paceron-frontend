# Tasks

> Depende del change `dashboard-analitico-rendimiento` de `paceron-backend`: las formas de
> response las fija ese change. Mientras tanto, se desarrolla contra **mocks** derivados de sus
> specs (ver task 2.1).

## 1. Geometría de gráficos (pura, testeable)

- [x] 1.1 `utils/dashboard-chart.js` — `scaleLinear(dominio, rango)` que maneja rango cero y valores `null` sin devolver `NaN`.
- [x] 1.2 `utils/dashboard-chart.js` — `linePath(puntos)`, `barPath()`, `stackedBar100()`, `dotPoints()`.
- [x] 1.3 `utils/dashboard-chart.js` — `boxPlotStats(valores)` para el gráfico de consistencia, con el criterio de outliers explícito. La consistencia mostrada en el KPI viene de `consistency.cv` de la API; esta función es solo la geometría del box plot.
- [x] 1.4 `utils/dashboard-chart.js` — `gaugeArc(valor, objetivo)`.
- [x] 1.5 `utils/dashboard-format.js` — `formatMetric(valor, unidad)` que devuelve `"—"` ante `null` y **nunca** `0` (design.md D5). La unidad viene del bloque `units` de la respuesta, no de un sufijo fijo en el componente.
- [x] 1.6 Tests de `utils/dashboard-*.test.js`: todos los valores iguales, un solo punto, rango cero, `null` intercalado, negativos, decimales, y que ningún helper devuelva `NaN`. **Incluido `utils/dashboard-error-codes.js`**: ese mapa decide qué estado se pinta en cada `400`, y una typo en `'INVALID_TOLERANCE'` muestra el mensaje genérico sin ningún error visible. El repo tiene 8 mocks testeados, así que el precedente existe.

## 2. Capa de datos

- [x] 2.1 `services/__mocks__/dashboard-mock.js` — en `services/__mocks__/`, **no** en `utils/`: un mock en `utils/` entra al bundle de la app. Branch `if (USE_MOCKS)` en `services/dashboard.js`, igual que `services/exercises.js:1-22` lee `config/env.js:5`. — mock derivado del **código del backend** (no de esta prosa): siembra filas de feedback y corre las mismas agregaciones de `domains/dashboard/*.go`, con los 5 tipos de ejercicio y al menos un caso de cada estado (con datos, vacío, sin permisos, `has_target: false`).
- [x] 2.2 `hooks/use-dashboard-filters.js` — `GET /dashboard/filters` vía TanStack Query.
- [x] 2.3 `hooks/use-dashboard-summary.js` — `GET /metrics/summary`.
- [x] 2.4 `hooks/use-dashboard-timeseries.js` — `GET /dashboard/metrics/timeseries`, con `granularity` parametrizable.
- [x] 2.5 `hooks/use-dashboard-comparisons.js` — `POST /dashboard/comparisons` y `POST /dashboard/comparisons/periods`.
- [x] 2.6 `hooks/use-dashboard-leaderboard.js` — `GET /dashboard/leaderboard` paginado y ordenable.
- [x] 2.7 `refetchInterval` de 60–120 s (90 s) en el summary y el timeseries. **La actualización no vuelve al estado de carga** (design.md D7): `loading` sale de `isLoading`, que en TanStack Query v5 es `isPending && isFetching`.
- [x] 2.8 `hooks/use-dashboard-series.js` — `GET /dashboard/exercises/{id}/series`, paginado. Es la fuente del detalle por serie y de la exportación.
- [x] 2.9 `services/dashboard.js` — los 7 endpoints, siguiendo el patrón de `services/exercises.js`.
- [x] 2.10 `DEFAULT_TOLERANCE = 0.05` en **`utils/dashboard-format.js`** y no en `config/env.js` (corregido al implementarlo): dos tests mockean `config/env.js` completo con su propia factory (`attendance-delete.test.js`, `checkin-service.test.js`), así que una constante exportada de ahí llega `undefined` bajo Jest. El `tolerance` se manda explícito en cada request —para que `tolerance_applied` de la respuesta sea el que el tooltip muestra y no un default invisible— y el rango válido (`0.01`–`0.20`) se valida en el cliente antes de mandar, para no gastar un `400` en un valor que el usuario no puede cambiar.

**Agregado al implementar §2 (no estaba en el plan):** `utils/date-field-format.js#fromISODate`, que era de la task 5.2c. La capa de datos lo necesita en el borde de la request: `DateField` emite `DD/MM/YYYY` y la API habla ISO, así que la normalización vive en `services/dashboard.js` y 5.2c solo tiene que sembrar `date_range` en el `DateField` sin convertirlo otra vez.

## 3. Geometría visual (SVG)

- [x] 3.1 `components/dashboard/charts/line-chart.jsx` — evolución de ritmo o de mejor marca, con dos series cuando el tipo lo permite.
- [x] 3.2 `components/dashboard/charts/bar-chart.jsx` — ranking horizontal, con inversión en paleta B (menor tiempo arriba) y los tres primeros destacados.
- [x] 3.3 `components/dashboard/charts/stacked-bar.jsx` — 100 % con las cuatro bandas que **llegan calculadas** del backend: `band_counts` por bucket y `band` por serie. El front NO las recalcula: los umbrales de `near` y el signo invertido del eje temporal viven en el backend, y duplicarlos acá es la vía directa a que el gráfico y el KPI se contradigan. Con `has_target: false` las cuatro llegan en cero.
- [x] 3.4 `components/dashboard/charts/dot-plot.jsx` — dispersión de series del corredor.
- [x] 3.5 `components/dashboard/charts/box-plot.jsx` — consistencia, con outliers marcados.
- [x] 3.6 `components/dashboard/charts/gauge.jsx` — ritmo logrado contra objetivo.
- [x] 3.7 `components/dashboard/charts/bullet-chart.jsx` — cumplimiento de objetivo.
- [x] 3.10 `components/dashboard/charts/radar-chart.jsx` — SVG con `react-native-svg`, mismo `onLayout` que el resto (task 3.1). `accessibilityRole="image"` + `accessibilityLabel` con los cinco valores, y la tabla de valores crudos debajo.
- [x] 3.11 `normalizeRadarAxes({ totals, trend, consistency })` en `utils/dashboard-chart.js` — pura y testeable, como el resto de la geometría. **El eje Volumen se normaliza contra un máximo fijo declarado en el front (100 km por período)**, no contra un máximo del scope: ningún endpoint del contrato expone el volumen máximo del scope, y pedirlo sería agregar un campo al contrato solo para pintar un radar. El eje Volumen se rotula con su valor absoluto al lado, así que el 0,7 del polígono no se lee como si fuera un dato comparable entre corredores.
- [x] 3.12 `__tests__/dashboard-radar.test.js` — normalización de los 5 ejes; en particular que consistencia se **invierte** (más `cv` = menor valor) y que un `cv` de 0 dé 100; y que **todos los ejes quedan dentro de `[0, 100]`** con valores extremos (`trend_pct = +12` → 110 sin recortar, `cv = 1,2` → −20 sin recortar).
- [x] 3.8 Todos consumen la geometría de `utils/dashboard-chart.js`, no calculan coordenadas adentro.
- [x] 3.9 Todos aceptan **solo** transform/opacity para animación (design.md, spec de movimiento reducido).

## 4. Las tres paletas

- [x] 4.0 `components/dashboard/palette-reduced-target.jsx` — **tercer caso**, el que faltaba: envuelve `palette-with-target.jsx` y oculta las piezas de ritmo (gauge y velocidad esperada), con la distancia como numero principal. No es un contenedor nuevo con estructura duplicada: las piezas compartidas con A completo (cumplimiento, delta, evolucion) son las mismas, y duplicarlas es la via directa a que se desincronicen. Aplica a Velocidad Maxima 100/200 m y a `elongacion` cuando `target_speed_kph` sea `null`.
- [x] 4.1 `components/dashboard/palette-with-target.jsx` — ritmo, delta semántico, cumplimiento, consistencia, ranking, evolución.
- [x] 4.2 `components/dashboard/palette-without-target.jsx` — mejor tiempo como número grande, ranking, dispersión, evolución de marca, comparación.
- [x] 4.3 Conmutación por la **tupla `(has_target, axis, target_speed_kph != null)`** de la respuesta, no por `kind`, en un contenedor estable, con **tres** casos y no dos: A completo, **A reducido** (eje `distance`: número principal = distancia, sin gauge de ritmo ni velocidad esperada) y B. A reducido aplica a 2 de los 12 ejercicios del seed (Velocidad Máxima 100 y 200 m); Pasadas 1000/2000 sí llevan `minutes`, así que son A completo. `elongacion` (eje `time`, sin distancia) entra en A completo salvo que `target_speed_kph` venga `null`, caso en el que cae a A reducido: **no** desmonta los KPIs ni pierde scroll (design.md D3).
- [x] 4.4 `liviano` muestra **volumen** como número principal, nunca ritmo: el tipo se define por volumen (`utils/exercise-field-matrix.js:24-31`, `showSpeed: false`). Para `elongacion` (eje `time`) el número principal es el tiempo, y las piezas de ritmo no se pintan si no hay velocidad objetivo.

## 4b. Tooltips de KPI

- [x] 4b.1 `components/dashboard/kpi-tooltip.jsx` — muestra la fórmula del KPI, `tolerance_applied` y `series_count`.
- [x] 4b.2 Abre con hover y con foco de teclado (no solo hover). En touch, al primer tap.
- [x] 4b.3 Accessible: el trigger lleva `accessibilityHint` con el valor y la unidad, y el contenido del tooltip se anuncia.

## 5. Filtros y layout

- [x] 5.1 **Borrar `components/dashboard/kind-filter.jsx`.** El tablist de tipos era un error de lectura del pedido: el filtro es de **selección única** con "todos" como valor vacío, y va como **primer** filtro de la barra, no como un grupo de botones arriba. Reemplazado por el desplegable de `5.2`. Sacarlo también de `dashboard-screen.jsx` y de cualquier import.
- [x] 5.1b `components/dashboard/type-filter.jsx` — desplegable de selección única con los **tres** tipos con métrica (`ritmo_continuo`, `velocidad_distancia`, `velocidad_tiempo`) más la opción **"Todos"** (valor vacío). Va por `ResponsiveSelectField` (obligatorio por `local/no-direct-select-field`). Las labels salen de `EXERCISE_KIND_META` (`components/plans/exercise-kind-meta.js:15-26`); **no** ofrecer `liviano` ni `elongacion`: sus series son `warmup`/`cooldown` y nunca pasan el filtro `role = 'main'`.
- [x] 5.1c `utils/dashboard-filter-cascade.js` — lógica pura de la cascada, testeada: `exercisesForKind(exercises, kind)` y `reconcileExercise(exercises, kind, currentExerciseId)` que **devuelve `null`** si el ejercicio elegido ya no pertenece al tipo. Sin ese segundo paso queda un estado imposible visible (filtro de distancia con un ejercicio de ritmo continuo arriba).
- [x] 5.2 `components/dashboard/filters-bar.jsx` — reescribir con el orden en cascada: **Tipo** (5.1b, primero y obligatorio) → **Ejercicio** (se completa con los del tipo) → **Rango de distancia** → **Rango de tiempo** → **Fechas**. Renombrar el picker actual de "Tipo de ejercicio" a **"Ejercicio"**: el rótulo anterior confundía el filtro de categoría con el de ejercicio concreto.
   Los cuatro campos de rango van **deshabilitados** mientras no haya ejercicio elegido.
- [x] 5.2d `components/forms/number-field-with-suggestions.jsx` — campo numérico **escribible a mano** + desplegable de sugerencias. El repo no lo tiene: `ResponsiveSelectField` es un `select` cerrado, y acá el usuario tiene que poder escribir 3,5 aunque no esté en la lista.
   Es un `InputField` con `AnimatedDropdown` al lado, siguiendo el patrón de `UserSuggestionsList` (`components/forms/fields.jsx:958`) — **no** reusar `icon-tooltip.jsx`, que es web-only y no cubre tap ni teclado.
   Props: `label`, `value`, `onChange`, `unit`, `suggestions` (números), `disabled`, `error`, `idPrefix`. Un valor escrito que no esté en la lista queda seleccionado igual, para que se vea qué se está filtrando.
   `nativeID` + `testID` en cada elemento (regla `local/require-native-id`).
- [x] 5.2e `utils/dashboard-range.js` — `DISTANCE_SUGGESTIONS_KM` (1, 2, 3, 5, 7, 10, 15, 21, 42), `TIME_SUGGESTIONS_MIN` (5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360), `kmToMeters(km)`, y `parseRangeInput(texto)` que devuelve `null` ante vacío y **`NaN` ante texto no numérico**, para que el campo muestre error en vez de mandar `undefined`.
   La conversión a metros ocurre **aquí**, en el borde, nunca en el valor mostrado.
- [x] 5.2f `__tests__/dashboard-range.test.js` — conversión km→m, parseo de "3,5" y "3.5", vacío → `null`, "abc" → error, y que los rangos invertidos se detecten antes del request.
- [x] 5.2g `hooks/use-dashboard-filters.js` (o el estado equivalente) — los 4 params de rango entran a la **query key** de los hooks, o el cache devuelve el resultado de otra combinación de filtros. Ojo con el nombre: el backend los llama `distance_from_m`, `distance_to_m`, `time_from_min`, `time_to_min`; el front los maneja en km/min y convierte al serializar.
- [x] 5.2c `utils/date-field-format.js#fromISODate` + test — el **inverso** de `toISODate`, que ya existe (`utils/date-field-format.js:10`). `DateField` emite `DD/MM/YYYY` en todas las plataformas desde el 2026-10-04 (`CLAUDE.md`) y la API habla ISO: sin el inverso, `date_range.min` sembrado en un `DateField` muestra `01-09-2026` sobre un placeholder `DD/MM/AAAA` y el picker nativo lee basura. Ojo: `format-date-display.js:5` devuelve `DD-MM-YYYY` con guiones, que `parseDDMMYYYY` (`fields.jsx:261`) **no** parsea: no sirve como inverso.

**Decisiones que quedaron al implementar §5 (no estaban en el plan):**

- **La lista de sugerencias se despliega en flujo, no con `AnimatedDropdown`.** Un panel absoluto anidado adentro de un form queda **debajo de los campos de abajo en nativo**: React Native pinta en orden de árbol y el `zIndex` de un nieto no compite con los tíos (en web el `z-index: 50` de `AnimatedDropdown` sí resuelve, que es exactamente por lo que el problema no se ve en el preview). Se mantiene el patrón de `UserSuggestionsList` —input con un control al costado y la lista con el valor tipeado marcado como seleccionado— y no se reusa `icon-tooltip.jsx`, que es web-only. Verificar en device antes de volver al overlay flotante: si se floating, tiene que ser el **último hijo** de un ancestro común de todo lo que puede tapar, no un descendiente del campo.
- **La clave de los cuatro de rango se armó en `hooks/use-dashboard-query.js#dashboardScopeKey`**, que es la pieza compartida por los cinco hooks de métricas, y no en `use-dashboard-filters.js`: ese hook es el de `GET /dashboard/filters`, que no lleva filtros de rango. Test propio en `__tests__/dashboard-query-key.test.js`.
- **`kind` y `exercise_id` son excluyentes en el backend** (`resolveExerciseFilter`), así que con un ejercicio elegido la pantalla manda **solo el ejercicio**: el tipo ya viene implícito en él. Mandar los dos sería un 400 que la pantalla no puede resolver.
- **El contrato exige enteros no negativos**, y el contrato de la UI muestra km con decimales: `resolveDashboardRange` convierte a metros enteros en el borde y **no aplica** el valor que no se puede expresar (3 decimales de más, negativo, texto), con el error en el campo. Mandarlo "redondeado" sería mostrar un filtro que no es el que la persona escribió.
- **El mock se migró al contrato nuevo** (`kind` escalar, los cuatro de rango aplicados en el WHERE con validación, `liviano`/`elongacion` rechazados con 400) porque si no el filtro de tipo se habría aplicado en silencio: el mock leería un `kinds` que ya no se manda y devolvería el scope entero.
- [x] 5.3 `components/dashboard/kpi-tile.jsx` — número grande, unidad, delta, veredicto, y "—" ante `null`.
- [x] 5.4 `components/dashboard/quality-banner.jsx` — los cinco contadores de defecto como advertencia, y `legacy_sessions` como nota al pie informativa con su aclaración — `data_quality`, y oculta las tendencias cuando `insufficient_data`.
- [x] 5.4b `components/dashboard/runner-progress.jsx` — la variante del corredor: reusa `palette-with-target.jsx` y los KPIs, y **no** importa `leaderboard-table.jsx` ni `comparison-strip.jsx`.
- [x] 5.5 `components/dashboard/leaderboard-table.jsx` — paginado, ordenable solo por las 4 columnas de la whitelist del backend, con la fila propia marcada por `is_self` y la posición tomada del `position` de la respuesta, para poder mostrar "vas 14°" sin traer todas las páginas.
- [x] 5.6 `components/dashboard/comparison-strip.jsx` — período actual vs anterior, con la diferencia en **puntos porcentuales**.

- [x] 5.9 `utils/dashboard-error-codes.js` — mapa literal de códigos, sin strings sueltos. El backend responde con códigos **UPPER_SNAKE** (convención ya existente en `constants/error_code.go`). El front SHALL tener un mapa literal en `utils/dashboard-error-codes.js`, sin strings sueltos:

| `code` | Cuándo | Qué hace la pantalla |
|---|---|---|
| `MISSING_FROM` | faltó el rango | ofrece elegir fechas |
| `INVALID_RANGE` | rango > 2 años | ofrece acotar el rango |
| `INVALID_TOLERANCE` | tolerancia fuera de `[0.01, 0.20]` | avisa y vuelve al valor por defecto |
| `INVALID_SORT` / `INVALID_GRANULARITY` / `INVALID_PAGE_SIZE` | parámetro no admitido | vuelve al valor por defecto, sin pedir nada |
| `403` sin `code` | recurso fuera de scope | estado "sin permisos" |

`services/api.js:98-101` ya deja `error.status` y `error.data` disponibles, así que el mapa no requiere tocar la capa de API.

  Además, el `retry: 1` global de `lib/query-client.js:13` SHALL desactivarse para este módulo: un `400`/`403`/`404` no mejora reintentando, y el reintento automático retrasa el estado de error que la pantalla necesita mostrar. Los errores reintentables son solo red y `5xx`.

## 6. Estados

- [x] 6.1 `components/dashboard/state-skeleton.jsx` — reusar `components/shared/skeleton.jsx` (usado por 5 pantallas) **agregándole el guard de movimiento reducido que hoy no tiene**: su shimmer es `withRepeat(withTiming(...))` infinito (`skeleton.jsx:7-9`). Reanimated exporta `useReducedMotion`, y el repo tiene **cero** ocurrencias de `prefers-reduced-motion`. Sin ese guard, un skeleton animado durante 60–120 s de sondeo es exactamente el caso donde el movimiento reducido molesta. — misma disposición que el contenido final, sin salto de layout.
- [x] 6.2 `components/dashboard/state-empty.jsx` — "No hay estadísticas disponibles aún" + CTA que amplía el rango.
- [x] 6.3 `components/dashboard/state-error.jsx` — error transitorio: mensaje + botón de reintento.
- [x] 6.3b `components/dashboard/state-invalid-request.jsx` — `400`: explica qué filtro corregir según el `code`, **sin** botón de reintento.
- [x] 6.3c `components/dashboard/state-not-found.jsx` — `404`: mensaje + volver al listado, sin reintento.
- [x] 6.4 `components/dashboard/state-forbidden.jsx` — sin revelar si el recurso existe.
- [x] 6.5 `components/dashboard/state-onboarding.jsx` — primer uso, guiando a elegir grupo y tipo.

## 7. Exportación

- [x] 7.1 `utils/dashboard-export.js` — `toCsv(series)` con encabezados en español y la unidad de `units` en el nombre de columna, **incluyendo `athlete_user_id` y `feedback_owner_user_id`**: un CSV exportado por el entrenador tiene que distinguir quién ejecutó de quién reportó, porque el leaderboard agrupa por ejecutor y un CSV que no lo diga no se puede reconciliar con la pantalla. (`Velocidad (km/h)`). Separador `;` y BOM UTF-8, porque el destino real es una planilla en español, donde la coma es separador decimal. Parte **pura y sin dependencias de plataforma**: es lo único testeable con Jest.
- [ ] 7.1b `services/dashboard-csv.js` — entrega **nativa**: `new File(Paths.cache, nombre).write(texto)` + `expo-sharing`. **No usar `writeAsStringAsync`**: `expo-file-system@19` no lo expone en el export raíz (solo existe en `/legacy`, y en la raíz hay un shim que es un `console.warn` de migración). Escribirlos a mano rompe el build; heredarlo de la doc vieja rompe en runtime.
- [ ] 7.1c `services/dashboard-csv.web.js` — entrega **web**: `Blob` + `URL.createObjectURL` + `<a download>` clickeado **sincrónicamente dentro del `onPress`**, antes de cualquier `await`; un click de descarga emitido después de un `await` lo bloquea el navegador. El `import` desde el call site va **sin extensión** (`from '../../services/dashboard-csv'`): con extensión explícita Metro carga el archivo nativo en web, sin error pero con el camino equivocado.
- [ ] 7.2 `services/dashboard-pdf.js` — camino nativo con `expo-print` + `expo-sharing`.
- [ ] 7.3 `services/dashboard-pdf.web.js` — reusar `openBrowserPrintDialog` de `utils/attendance-qr-file.js:221-274` (iframe con `srcdoc`, `onload`/`onerror`, y **rechazar** en vez de caer a `window.print()`), y **no** copiar `receipt.web.js:12-15`, que usa `document.write` y pierde el camino de error. — camino web con `iframe` + `print()`, siguiendo `services/receipt.web.js`. **No usar `expo-print` en web**: su implementación imprime la página de la app entera.
- [ ] 7.4 `__tests__/dashboard-export.test.js` — **solo la parte pura**: BOM y `;`, escaping de comas y comillas, cabeceras con unidad, y que un `null` produzca celda vacía y no `0` ni la palabra `null`. **No** se testea la descarga web: el env de Jest es `react-native/jest/react-native-env.js` (sin `document` ni `window`) y el repo no tiene tests de render, así que ese camino no es observable desde un test.

## 8. Pantalla y ruta

- [ ] 8.1 `app/(tabs)/teams/[teamId]/dashboard.jsx` + `.web.jsx` si difieren, siguiendo el patrón de split del repo (import **sin** extensión). Va **dentro de `teams/[teamId]/`**, no en `(tabs)` raíz.
- [ ] 8.1b **NO se toca `routes/catalog.js` ni `__tests__/routes.catalog.test.js`.** El acceso es por pestaña, no por navegación: el caso "la última ruta es Pagos" sigue siendo cierto porque el catálogo no cambia. Si alguien agrega `dashboardRoute` "para que aparezca en el menú", ese test lo rompe — y es intencional: la decisión es que **no** va en el menú principal.
- [ ] 8.1c `components/team/team-detail-screen.jsx` — agregar `{ id: 'rendimiento', label: 'Rendimiento', icon: 'chart-timeline-variant' }` a `TABS` (línea 70). **No hace falta tocar `visibleTabs`** (línea 993): ese filtro solo saca `grupos` y `solicitudes`, así que la pestaña aparece para **los dos roles** sola.
  Aprovechar el mismo diff para **reemplazar los 3 `StatTile` con `MOCK_TEAM_METRICS`** de la pestaña `general` (líneas 843-845) por datos reales, o borrarlos si el dashboard ya los cubre. Hoy son datos falsos en pantalla.
- [ ] 8.2 `components/dashboard/dashboard-screen.jsx` — orquesta estados, paletas y filtros. Recibe `teamId` y monta **dos variantes por rol**, no una filtrada:
  - **Entrenador**: KPIs, evolución, radar, leaderboard, comparaciones.
  - **Corredor**: KPIs, evolución, radar, cumplimiento y detalle de series. **No monta leaderboard ni comparaciones**: con un solo corredor, un ranking de una fila y una comparación consigo mismo no son información, son ruido. Se decide con `activeRole` y el componente ni entra al árbol del corredor.
  El backend además rechaza `/leaderboard`, `/comparisons` y `/comparisons/periods` con `403` si el llamador es corredor, así que la regla no queda solo en la UI.
- [ ] 8.3 En mobile: filtros en hoja inferior; orden KPIs → gráfico principal → leaderboard colapsado; sin scroll horizontal.
- [ ] 8.4 `nativeID` + `testID` en todo elemento visual nuevo (regla `local/require-native-id`).

## 9. Accesibilidad y responsive

- [ ] 9.1 Navegación por teclado de punta a punta, con foco visible.
- [ ] 9.2 Cada gráfico con descripción textual equivalente (`accessibilityLabel` o `role="img"` + `aria-label`).
- [ ] 9.3 Ningún significado solo por color: ícono + texto en cada señal.
- [ ] 9.4 `prefers-reduced-motion` respetado en todas las transiciones.
- [ ] 9.5 Touch targets ≥ 44 px; los botones del stepper y del filtro incluidos.
- [ ] 9.6 Contraste verificado en tema claro **y** oscuro.

## 10. Performance

- [ ] 10.1 Módulo de gráficos con carga diferida.
- [ ] 10.2 Medir el delta de bundle: **+80 KB gzip** como techo.
- [ ] 10.3 `queryClient` con `staleTime` por endpoint — el summary y el leaderboard cambian poco.

## 11. Cierre

- [ ] 11.1 `npm test` verde, incluidos los nuevos tests de `utils/dashboard-*`.
- [ ] 11.2 `npm run lint` sin errores — incluidas las 3 reglas `local/*`.
- [ ] 11.3 Verificación manual de los **siete** estados (carga, vacío, primer uso, 400, 403, 404, error transitorio) y de los **tres** casos de paleta, en web y mobile. El `400` entra en el checklist porque es el único con componente propio y con la regla más específica de toda la spec (no ofrecer reintento): si no se verifica a mano, es el primero que se rompe en silencio.
- [ ] 11.4 Capturas de loading / cargado / vacío / error en desktop y mobile (entregable del PR).
- [ ] 11.5 `openspec validate dashboard-analitico-rendimiento` en verde.
