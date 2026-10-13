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
- **Exportación CSV y PDF** desde los datos ya cargados en memoria.
- **Selector de tipificación** que conmuta la paleta automáticamente.

### Objetivo

Que el corredor vea su evolución sin pedirle el número a nadie, y que el entrenador detecte a quién mirar sin abrir una planilla.

### Alcance

Vista de corredor y vista de entrenador sobre los mismos endpoints. El cálculo, la autorización y el ordenamiento son del backend: el front solo las presenta.

## Capabilities

### New Capabilities
- `dashboard-screen`: analítica de rendimiento **en dos variantes por rol, no una filtrada**. El entrenador ve KPIs, evolución, radar, leaderboard y comparaciones; el corredor ve **solo progresión propia** —KPIs, evolución, radar, cumplimiento y detalle de series— sin leaderboard ni comparaciones, que con un solo corredor no significan nada. Mismos endpoints, componentes compartidos, montaje distinto.

### Modified Capabilities
- ninguna

## Non-Goals

- **No se replica ningún cálculo de KPI en el front.** Ritmo, cumplimiento, tendencia y calidad de datos vienen calculados. Recalcular acá es la forma garantizada de que la pantalla y la API digan cosas distintas.
- **No se agrega librería de gráficos.** `react-native-svg` ya está instalado y hay geometría testeada en `utils/payments-chart.js` y `utils/trajectory.js`.
- **No se toca el design system.** Solo tokens existentes.
- **No hay WebSocket para el dashboard.** Se resuelve con polling; el WS del repo es por sesión, no por scope.
- **No se implementa el backend.** Es el change paralelo en `paceron-backend`.

## Impact

- **Rutas**: `/teams/[teamId]/dashboard` nueva. **No entra al catálogo de navegación**: el acceso es desde la pestaña del detalle de equipo. Ninguna ruta existente cambia, y `routes/catalog.js` y `__tests__/routes.catalog.test.js` **no se tocan**.
- **APIs consumidas**: las 7 de `/api/v1/dashboard`.
- **Dependencias**: ninguna nueva.
- **Bundle**: los gráficos van en un módulo cargado de forma diferida, con el budget de +80 KB gzip.
