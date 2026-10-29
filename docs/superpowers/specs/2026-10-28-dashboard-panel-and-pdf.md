# Pestañas del panel de rendimiento y salida PDF

## Objetivo

Organizar debajo de Filtros el contenido de Métricas deportivas y permitir imprimirlo completo, sin que el resultado dependa de qué pestaña o gráfico esté desplegado.

## Alcance

- Crear pestañas internas `KPIs`, `Gráficos` y `Ranking` (Ranking solo cuando el rol tenga esa capacidad).
- En `KPIs`, mostrar las seis tarjetas de la paleta activa y el Perfil en 5 ejes.
- En `Gráficos`, conservar las tarjetas colapsables y su acción de maximizar/minimizar.
- El PDF de Métricas debe reunir KPIs, perfil, gráficos expandidos y ranking en orden vertical.
- El PDF de Comparación debe capturar el contenido de la pestaña principal activa.
- Ocultar CSV en Comparación; el CSV sigue disponible en Métricas deportivas.

## No alcance

- No cambiar consultas, cálculos, filtros, permisos ni contratos de API.
- No cambiar el orden visual normal ni el estado colapsable inicial de los gráficos.

## Verificación

- Probar el contenido de cada pestaña y permisos por rol.
- Imprimir desde Métricas y desde Comparación; confirmar que el PDF corresponde a la pestaña activa.
- `npm test` y `npm run lint`.
