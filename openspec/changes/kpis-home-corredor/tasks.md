# Tasks

## 1. Utilidades puras de la tarjeta

- [x] 1.1 Crear `utils/runner-kpis.js` con `RUNNER_KPI_TABS` (label, `tab` y orden), `RUNNER_KPI_ROWS` por pestaña y `PERIOD_OPTIONS` (`month`, `week`, `day` con labels `Mes`, `Semana`, `Día`).
- [x] 1.2 Implementar `buildPeriodTitle({ period, from, to, daysConsidered })` con `MONTHS_ES`, rango `DD/MM/YYYY` y singular/plural de días, sin depender de `Intl.DateTimeFormat`.
- [x] 1.3 Implementar `formatDistanceM(value)`: `null → "—"`, `< 1000` en metros enteros y `>= 1000` en km con un decimal reutilizando el formateador de `utils/dashboard-format.js`.
- [x] 1.4 Implementar `formatRunnerKpiValue(field, value)`: distancia y fecha con sus helpers; velocidad y tiempo con `formatMetric`; `null` siempre `—`.
- [x] 1.5 Exportar `runnerKpisQueryKey({ period, referenceDate, tab })` con el prefijo `['runner-kpis']` que usa la invalidación del Home.
- [x] 1.6 Crear `__tests__/runner-kpis.test.js`: doce meses, febrero bisiesto, semana que cruza de mes, `1 día` vs `31 días`, las cuatro pestañas y sus filas, `850 → "850 m"`, `12400 → "12,4 km"`, `0 → "0 m"`, `null → "—"`, `1380000 → "23:00"` y `112.4 → "112,4 %"`.
- [x] 1.7 Agregar al mismo test que la fecha `2026-10-11` se muestra `11/10/2026` y que un `best_day_date` nulo no rompe la tabla.
- [x] 1.8 Agregar al mismo test que cambiar `period`, `referenceDate` o `tab` cambia la query key y que las tres keys comparten el prefijo `runner-kpis`.

## 2. Servicio y mock

- [x] 2.1 Crear `services/runner-kpis.js` con `getRunnerKpis({ period, referenceDate, tab })`; convertir `referenceDate` a ISO con `toISODate` en el borde y armar la URL `/dashboard/runner-kpis`.
- [x] 2.2 Enviar solo `period`, `reference_date` y `tab`; no agregar `team_id`, `group_id` ni `athlete_user_id`.
- [x] 2.3 Crear `services/__mocks__/runner-kpis-mock.js` con `mockGetRunnerKpis`, reutilizando `__getMockDashboardSeed()` y aplicando las reglas de período y pestaña del contrato.
- [x] 2.4 En el mock, devolver `has_data=false`, métricas `null` y contadores `0` cuando el `callerUserId` no tiene filas; no inventar datos.
- [x] 2.5 Crear `__tests__/runner-kpis-service.test.js` con `api.get` mockeado: URL exacta, parámetros exactos, ausencia de ids de scope y normalización de `referenceDate`.
- [x] 2.6 Cubrir la rama `USE_MOCKS=true`: el servicio delega en `mockGetRunnerKpis` y no llama a `api.get`.
- [x] 2.7 Test del mock: un corredor con filas recibe sus métricas en `general`, y `ritmo_continuo` no devuelve las de velocidad.

## 3. Hook de consulta

- [x] 3.1 Crear `hooks/use-runner-kpis.js` con `useQuery` sobre `runnerKpisQueryKey`, `queryFn` al servicio, `staleTime: 0` y `retry: dashboardRetry`.
- [x] 3.2 Exponer `data`, `loading` (`isLoading`), `refreshing` (`isFetching && !isLoading`), `failed`, `error` y `refetch`.
- [x] 3.3 NO usar `placeholderData: keepPreviousData`: la pestaña nueva no debe mostrar los números de la anterior.
- [x] 3.4 Verificar que la key incluye `period`, `referenceDate` y `tab`; agregar el caso a `__tests__/runner-kpis.test.js`.
- [x] 3.5 No habilitar prefetch de las otras tres pestañas ni `refetchInterval`: la tarjeta no se sondea.

## 4. Componente de la tarjeta

- [x] 4.1 Crear `components/home/runner-kpis-card.jsx` con estado `period` (default `month`), `tab` (default `general`) y `referenceDate` local calculada al montar.
- [x] 4.2 Renderizar la cabecera con el título de `buildPeriodTitle`, el selector `Mes`/`Semana`/`Día` y las cuatro pestañas en el orden del contrato.
- [x] 4.3 Implementar el handler de pestaña: setear `tab` y, si ya era la activa, llamar a `refetch()` para que cada selección consulte.
- [x] 4.4 Implementar el cambio de período conservando la pestaña activa; la key nueva dispara la consulta sola.
- [x] 4.5 Renderizar la tabla de dos columnas con las filas de la pestaña, usando `formatRunnerKpiValue` y sin cálculos en el JSX.
- [x] 4.6 Montar `DashboardLoadingOverlay` con `visible={loading}` dentro de un contenedor `relative` de la tarjeta; no cubrir el Home completo.
- [x] 4.7 Mostrar un indicador discreto cuando `refreshing` sea verdadero y haya datos, sin montar la capa de carga.
- [x] 4.8 Implementar error reintentable con `Reintentar` y error `400` sin botón, usando `resolveDashboardError`.
- [x] 4.9 Implementar `has_data=false`: filas con `—`, nota `Sin datos en este período.` y pestañas visibles.
- [x] 4.10 Agregar roles de tab, estado seleccionado, `role="tablist"` solo en web, etiqueta combinada por fila, `nativeID` y `testID` en cada control nuevo.
- [x] 4.11 Ajustar responsive: `ScrollView horizontal` para las pestañas en 360 px, tabla sin scroll horizontal y `max-w-3xl` heredado del contenedor del Home.

## 5. Integración con el Home

- [x] 5.1 Importar `RunnerKpisCard` en `components/home/authenticated-home-screen.jsx` y montarlo después de `AchievementHighlightCard`, dentro del fragment de `activeRole === 'runner'`.
- [x] 5.2 Verificar que `NextTrainingBanner`, `StreakBanner` y `AchievementHighlightCard` conservan su orden y comportamiento.
- [x] 5.3 Sumar `queryClient.invalidateQueries({ queryKey: ['runner-kpis'] })` a la lista del `usePullToRefresh`, solo bajo el guard de runner.
- [x] 5.4 Confirmar que el montaje no dispara requests para entrenadores ni para otros roles.

## 6. Verificación y regresión

- [x] 6.1 Ejecutar `npm test -- --runInBand` y corregir cualquier fallo de los tests nuevos o existentes.
- [x] 6.2 Ejecutar `npm run lint` y corregir los avisos introducidos por los archivos nuevos.
- [x] 6.3 Verificar manualmente contra el backend local: Home de corredor con datos en dos equipos, mes/semana/día y las cuatro pestañas.
- [x] 6.4 Verificar manualmente los estados: primera carga con el GIF, revalidación sin capa, error de red con `Reintentar`, `400` sin botón y período sin datos.
- [x] 6.5 Verificar en web con teclado que las pestañas y el selector de período se activan y anuncian el estado seleccionado.
- [x] 6.6 Verificar en mobile de 360 px que la tabla se lee completa y que las pestañas no desbordan la tarjeta.
- [x] 6.7 Confirmar que no se modificó ningún archivo de `components/dashboard/`, `services/dashboard.js` ni los hooks del dashboard.
