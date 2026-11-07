# Diseño: KPIs del Home del entrenador y espera en Rendimiento

## Home del entrenador

El nuevo `TrainerHomeKpisCard` aparece en `AuthenticatedHomeScreen` solo con
`activeRole === 'trainer'`, después del aviso de pagos y de `NextTrainingBanner`
(por ejemplo, “Sesión de volumen”). Así la próxima sesión queda arriba del
resumen. La tarjeta usa el ancho y aspecto de `RunnerKpisCard`.

El primer bloque, **Este período**, usa tabs `Mes`, `Semana`, `Día` y muestra:

1. `Sesiones`: `programadas / realizadas`.
2. `Sesiones presenciales`: `programadas / realizadas` (subconjunto).
3. `Cobrado neto`.
4. `Pendiente de cobro` (monto; el tooltip agrega cantidad de cuotas).

El segundo bloque, **Tu estructura actual**, muestra `Equipos activos` y
`Corredores activos` (únicos entre equipos). No depende del selector temporal.
Todos los valores salen de una única respuesta del backend; el front no infiere
sesiones ni recalcula cobros.

Cuando un tooltip está abierto, su grilla sube por encima del otro bloque de
KPIs. Cada bloque mantiene stacking order separado: elevar ambos al mismo nivel
deja la sección de estructura (que se pinta después) encima de los tooltips de la
última fila temporal. Además, la tarjeta completa usa una capa superior mientras
hay un tooltip abierto, y cada nivel de la jerarquía tiene `position: relative`
explícito y z-index ascendente (celda, grilla y tarjeta) para superar los
stacking contexts que React Native Web crea en cada `View` y en cards vecinas.

Cada valor usa `KpiTile` + `KpiTooltip`. Las fórmulas explican el rango, el
criterio de realizada y que el neto descuenta comisión. `formatRunnerKpiValue` se
reusa donde corresponda; los montos se formatean con locale/currency recibido.

## Query y carga del Home

`useTrainerHomeKpis({period, referenceDate})` usa TanStack Query; key por período
y fecha, sin `keepPreviousData` para no mostrar valores de otro corte. El primer
load usa `DashboardLoadingOverlay` con `Cargando resumen…`. En refetch con datos
se conservan los datos y se informa `Actualizando…`. Pull-to-refresh invalida
`['trainer-home-kpis']` solo para rol trainer.

`DashboardLoadingOverlay` acepta `id`/`label` opcionales con defaults actuales,
preservando al consumidor existente. `TrainerHomeKpisCard` mantiene un root
redondeado y sin `overflow-hidden` para no recortar tooltips.

## Espera en Rendimiento

La misma animación aparece solo durante una carga inicial efectiva (`isLoading`),
no durante polling/refetch con datos visibles:

- Métricas/Gráficos: overlay de DashboardScreen mientras cargan filtros,
  resumen o series temporales iniciales. Gráficos usan esos mismos datos; no se
  dispara una consulta adicional al cambiar de subtab.
- Ranking: overlay local mientras la primera página del leaderboard carga.
- Comparación principal: overlay local durante la carga de filtros, roster,
  opciones de sesiones A/B, comparación de sesiones o comparación por períodos.
- Filtros ya cargados y estados de error conservan sus UI actuales; un error no
  deja la animación bloqueando la pantalla.

Los overlays locales se posicionan dentro de la superficie de su pestaña y
reciben IDs distintos. Las consultas de fondo no cubren datos ya visibles.

## Tests/validación

- Utilidades de labels, par `programadas/realizadas`, dinero, query keys y fechas.
- Servicio con parámetros y normalización del contrato.
- Test del pull-to-refresh invalida trainer KPIs solo en rol entrenador.
- Tests de estado del overlay para métricas/ranking/comparación y ausencia durante
  fetching de fondo si la arquitectura expone el estado.
- Suite Jest + lint y validación visual desktop/mobile con mocks y API local.
