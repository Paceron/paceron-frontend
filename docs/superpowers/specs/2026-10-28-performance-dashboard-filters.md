# Ajustes del panel de filtros de Métricas de rendimiento

## Objetivo

Hacer más claro y compacto el panel de filtros sin cambiar qué filtros consulta el backend.

## Alcance

- Agregar en `Ejercicio` una opción explícita “Todos los ejercicios” que limpia el filtro; el request omite `exercise_id`.
- Ocultar el resumen redundante “Todo el equipo” cuando no hay tipo ni ejercicio seleccionados.
- Agrupar los cuatro selectores de alcance/cascada, poner Distancia y Tiempo juntos en la fila siguiente, y dar una fila completa al rango de fechas.
- Dejar “Limpiar” y “Filtrar” alineados a la derecha debajo de las fechas.
- Reducir los espacios verticales entre las dos primeras filas.

## No alcance

- No cambiar el contrato de filtros, ni agregar un filtro de equipo.
- No modificar la variante de filtros mobile (sheet) más allá de conservar el orden y el ancho completo al apilarse.

## Comportamiento esperado

- “Todos los ejercicios” aparece como opción elegible aunque ya haya un ejercicio seleccionado.
- Seleccionarla deja `exerciseId` vacío; la query se serializa sin `exercise_id` y conserva los filtros de tipo, grupo y corredor.
- Los campos Desde/Hasta usan el ancho disponible de su propia fila, apilándose en ancho angosto, por lo que `DD/MM/AAAA` y el botón de calendario se ven completos.

## Verificación

- Comprobar la opción de limpiar ejercicio y que el servicio omita `exercise_id` vacío.
- Revisar el panel en ancho desktop y en el sheet angosto.
- `npm test` y `npm run lint`.
