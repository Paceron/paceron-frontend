# KPIs del Home del entrenador y espera de Rendimiento

## Why

Al abrir el Home, el entrenador no tiene un resumen operativo de sus equipos,
sesiones o cobranzas. Además, las vistas de Rendimiento pueden mostrar estados
vacíos/esqueletos mientras sus requests iniciales cargan, sin la animación GIF
de espera ya usada en el Home del corredor.

## What Changes

- Agregar una tarjeta para entrenador con controles Mes/Semana/Día, sesiones
  programadas/realizadas, sesiones presenciales programadas/realizadas, cobrado
  neto y pendiente de cobro.
- Separar equipos/corredores activos en un bloque de cifras actuales, fuera de la
  expectativa temporal del selector.
- Consumir `GET /dashboard/trainer-home-kpis` desde un hook/servicio nuevo; el
  front solo formatea valores del backend.
- Reutilizar el GIF/overlay existente con texto contextual y estados de carga.
- Mostrar el overlay también en las vistas de Rendimiento mientras sus requests
  iniciales de métricas, ranking o comparación cargan.

## Decisiones confirmadas

- Sesiones realizadas: sesiones con al menos una asistencia registrada; el
  tooltip lo explica.
- Cobrado neto + pendiente, no balance de gastos no registrados.
- Equipos/corredores quedan en un bloque separado y son cifras actuales.
- Esta tarea se suma al mismo PR frontend que los fixes de PDF/métricas en
  `feature/kpisHome`; backend también va junto en el branch/PR común del backend.

## Capabilities

### New Capabilities
- `trainer-home-kpis`: tarjeta y estados del resumen de Home del entrenador.

### Modified Capabilities
- `dashboard-performance-loading`: GIF/overlay para cargas iniciales de las
  vistas del dashboard de rendimiento.

## Impact

- `AuthenticatedHomeScreen`, nuevo componente/hook/servicio/normalizer/mock y
  utilidades de formato.
- Extensión configurable de `DashboardLoadingOverlay`.
- `DashboardScreen`, ranking y comparadores de sesiones/períodos.
- Tests puros/service/normalizer y verificación visual web.
