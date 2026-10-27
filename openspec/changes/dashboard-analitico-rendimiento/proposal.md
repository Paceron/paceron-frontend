# Proposal

## Why

El frontend no tiene **ninguna** vista de analítica. `app/(tabs)/` expone calendario, planes, perfil, equipos y asistencia — nada que responda "¿cómo vengo?" ni "¿cómo viene mi grupo?".

Los datos existen y se graban: `workout_feedback` tiene por serie `duration_ms`, `active_duration_ms`, `distance_meters`, FC, cadencia, desnivel y RPE, y hay histórico de varios meses. El backend no expone agregados, y el único endpoint cercano (`workout-feedback-history`) está paginado a 100, no expone RPE/FC/cadencia/desnivel, y su whitelist de ordenamiento no permite ordenar por `duration_ms` ni por distancia. O sea: **no hay forma de ver nada agregado sin exportar a una planilla y calcular afuera**.

Este change consume los endpoints que define el change `dashboard-analitico-rendimiento` de `paceron-backend`. No inventa cálculo: las fórmulas viven en el backend y el front las muestra.

## What Changes

- **Pestaña `Rendimiento` dentro del detalle de equipo**, en `/teams/[teamId]/dashboard`.
- **Tres casos de paleta de gráficos**, decididos por los datos de la respuesta y no por la tipificación: **A completo** (con objetivo de ritmo), **A reducido** (con objetivo solo de distancia, sin velocidad esperada) y **B** (sin objetivo).
- **Estados completos**: skeleton de carga, vacío con CTA, error con reintento, sin permisos y primer uso.
- **Comparación contra el período anterior** con veredicto (`improving` / `stable` / `regressing`).
- **Comparación entre dos ejercicios de sesiones A/B** dentro de la pestaña Comparación, conservando el modo actual de período. Cada lado selecciona grupo, corredor según el rol, ejercicio principal y sesión real, dentro de un rango de fechas propio del comparador. Muestra series, mejor/peor ejecución, velocidad, distancia recorrida y esfuerzo medio, con visualización por serie.
- **Selector de fecha/calendario compartido** en web y mobile para todos los rangos de fecha de la pantalla. La interfaz muestra `DD/MM/AAAA`; el servicio conserva la conversión a ISO que requiere el backend.
- **Exportación CSV y PDF** desde los datos ya cargados en memoria.
- **Selector de tipificación** que conmuta la paleta automáticamente.

### Objetivo

Que el corredor vea su evolución sin pedirle el número a nadie, y que el entrenador detecte a quién mirar sin abrir una planilla.

### Alcance

Vista de corredor y vista de entrenador sobre los mismos endpoints. El cálculo, la autorización y el ordenamiento son del backend: el front solo las presenta. El entrenador puede comparar dos sesiones del mismo corredor o de corredores distintos; el corredor compara únicamente sus propias sesiones.

## Capabilities

### New Capabilities
- **Criterios de filtrado, en cascada**: primero el **tipo** (desplegable de selección única, con "todos" como valor vacío), después el **ejercicio** que se completa con los de ese tipo, después los **rangos de distancia y tiempo** (escribibles a mano y con valores sugeridos) y por último las **fechas**. Los dos rangos van al backend: acotan qué series entran al cálculo, no solo qué se puede elegir.
- `dashboard-screen`: analítica de rendimiento **en variantes por rol**, con el filtro de tipo reducido a los **tres tipos con métrica** (`ritmo_continuo`, `velocidad_distancia`, `velocidad_tiempo`). `liviano` y `elongacion` quedan fuera de la comparación porque sus series son `warmup`/`cooldown` y no pasan el filtro `role = 'main'`. Se conservan la evolución, el radar, el ranking y la comparación por período. Se agrega comparación de sesiones A/B: el entrenador compara sesiones del mismo corredor o de dos corredores de su scope; el corredor solo compara sus propias sesiones.

### Modified Capabilities
- ninguna

## Non-Goals

- **No se replica ningún cálculo de KPI en el front.** Ritmo, cumplimiento, tendencia y calidad de datos vienen calculados. Recalcular acá es la forma garantizada de que la pantalla y la API digan cosas distintas.
- **No se agrega librería de gráficos.** `react-native-svg` ya está instalado y hay geometría testeada en `utils/payments-chart.js` y `utils/trajectory.js`.
- **No se toca el design system.** Solo tokens existentes.
- **No hay WebSocket para el dashboard.** Se resuelve con polling; el WS del repo es por sesión, no por scope.
- **No se implementa código del backend en este repositorio.** La comparación A/B depende de un endpoint nuevo que se especifica e implementa en un change coordinado de `paceron-backend`; el front no recalcula ni agrega KPIs desde las series crudas.

## Impact

- **Rutas**: `/teams/[teamId]/dashboard` nueva. **No entra al catálogo de navegación**: el acceso es desde la pestaña del detalle de equipo. Ninguna ruta existente cambia, y `routes/catalog.js` y `__tests__/routes.catalog.test.js` **no se tocan**.
- **APIs consumidas**: las 7 rutas actuales de `/api/v1/dashboard` y el nuevo `POST /api/v1/dashboard/comparisons/sessions` (change coordinado de backend). El endpoint de comparación por período existente se conserva.
- **Dependencias**: ninguna nueva.
- **Bundle**: los gráficos van en un módulo cargado de forma diferida, con el budget de +80 KB gzip.
