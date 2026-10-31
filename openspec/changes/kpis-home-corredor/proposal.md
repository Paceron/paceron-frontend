# Proposal

## Why

El Home autenticado del corredor hoy muestra la próxima sesión, la racha y el
logro más cercano. Cuando el corredor quiere saber **cómo le fue** en el mes, la
semana o el día, no tiene una respuesta en el Home: debe entrar a un equipo,
abrir Rendimiento, elegir un grupo y aplicar filtros. Ese recorrido no es el que
corresponde a una consulta rápida y además obliga a elegir un equipo cuando el
corredor puede pertenecer a varios.

El backend entrega el agregado en el change hermano `kpis-home-corredor` de
`paceron-backend`. El frontend SHALL consumirlo y mostrarlo sin recalcular nada.

## What Changes

- **Se agrega una tarjeta al final del Home del corredor**, después de
  `AchievementHighlightCard`. No se reemplaza, reordena ni modifica ningún
  componente existente del Home.
- **Selector de período en el título:** `Mes`, `Semana`, `Día`. Por default,
  mes calendario. El título SHALL mostrar el rango y la cantidad de días
  considerados que devuelve el backend.
- **Cuatro pestañas internas:** `Números generales`, `Ritmo continuo`,
  `Velocidad en tiempo` y `Velocidad en distancia`.
- **Cálculo bajo demanda:** al abrir la tarjeta se carga solo `general`; al
  seleccionar otra pestaña se dispara su request. Mientras esa pestaña no tiene
  datos, se muestra la misma animación del corredor que ya usa el dashboard.
- **Formato de tabla amigable:** cada pestaña es una tabla de dos columnas
  (métrica / valor), con distancias en km o m, velocidades en km/h, tiempos como
  reloj; sin porcentajes ni unidades inventadas por el front.
- **Sin cálculo en React:** el frontend solo compone la request y formatea los
  valores que devuelve la API.
- **Sin cambios en el dashboard existente:** la tarjeta del Home es un consumo
  nuevo del endpoint nuevo; no toca filtros, paletas, PDF, CSV ni permisos.

### Objetivo

Que un corredor vea en su Home, sin salir de la pantalla ni elegir equipo, sus
números del período y pueda alternar entre los cuatro cortes con una carga
acotada a la pestaña que abre.

### Alcance

- `components/home/authenticated-home-screen.jsx`: importar y montar la tarjeta
  al final del bloque de corredor.
- Nuevos componentes, servicio, hook y helper de formato para la tarjeta.
- Reutilización del GIF `assets/paceron-runner-waiting.gif` y de
  `DashboardLoadingOverlay` para el estado de carga.
- Tests puros de formato, servicio y hook; sin tests de render de componentes,
  siguiendo la convención del repo.

### No alcance

- No se reemplaza ni se rediseña `StreakBanner`, `AchievementHighlightCard` ni
  `NextTrainingBanner`.
- No se agregan gráficos, comparación de períodos, exportación CSV/PDF ni
  navegación a otra pantalla.
- No se muestra para entrenadores: el Home del corredor es el único destino.
- No se calculan métricas en el front ni se corrigen valores de la API.
- No se modifica el contrato del dashboard de equipos.

### Métrica de éxito

- La tarjeta aparece después del último componente del Home del corredor y no
  altera el orden ni el comportamiento de los anteriores.
- Al abrir el Home se hace una sola request (`general`, mes actual). Al tocar
  `Ritmo continuo` se hace una request con `tab=ritmo_continuo` y se ve el
  loading si no hay datos cacheados.
- Cambiar de mes a semana o día actualiza el título con el rango y los días
  considerados, y vuelve a pedir la pestaña activa.
- Los valores se muestran en formato es-AR y un `null` se ve como `—`, nunca
  como `0`.

## Capabilities

### New Capabilities

- `runner-home-kpis`: tarjeta de KPIs del Home del corredor, selector de período,
  pestañas bajo demanda, estados y formato.

### Modified Capabilities

Ninguna. La tarjeta es aditiva y no cambia requisitos de pantallas existentes.

## Impact

- **UI:** una tarjeta nueva al final del Home del corredor.
- **Red:** un endpoint nuevo, una request por pestaña y período.
- **Dependencias:** ninguna nueva. Se reutilizan `@tanstack/react-query`,
  `DashboardLoadingOverlay`, el GIF existente y los helpers de formato del
  dashboard.
- **Riesgo principal:** que el Home se alargue demasiado en mobile. Se mitiga con
  una tabla compacta, tabs de una línea con scroll horizontal solo si hace falta
  y sin gráficos.
